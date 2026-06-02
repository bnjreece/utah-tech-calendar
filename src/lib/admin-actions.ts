"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, events, sources, adminSettings, pendingSubmissions } from "@/lib/db";
import type { SubmissionPayload } from "@/lib/submission-payload";
import { requireAdmin } from "@/lib/admin-auth";

/* Detect a source-suggestion row (from /api/submit-source) vs an
   event draft (from /api/submit). Source rows carry type:"source"
   in their payload; everything else is an event draft. */
function isSourcePayload(p: unknown): p is { type: "source"; url: string; note?: string; title?: string } {
  return (
    !!p &&
    typeof p === "object" &&
    (p as Record<string, unknown>).type === "source" &&
    typeof (p as Record<string, unknown>).url === "string"
  );
}

/* Host -> adapter name. Mirrors pickAdapter() in /api/extract so an
   admin approving a source suggestion gets the right adapter assigned
   without re-deriving the logic. */
function adapterForUrl(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host === "meetup.com" || host === "www.meetup.com") return "meetup";
    if (host === "lu.ma" || host === "luma.com" || host === "www.luma.com") return "luma";
    if (host === "eventbrite.com" || host === "www.eventbrite.com") return "eventbrite";
    if (host === "siliconslopes.com" || host === "www.siliconslopes.com") return "siliconSlopes";
    return "htmlCalendar";
  } catch {
    return "htmlCalendar";
  }
}

export interface AdminSettingsInput {
  alertEmail: string;
  notifySourceErrors: boolean;
  notifySourceStale: boolean;
  notifyCookieExpiry: boolean;
  staleThresholdHours: number;
}

export async function saveAdminSettings(input: AdminSettingsInput) {
  await requireAdmin();
  const email = (input.alertEmail || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid alert email");
  }
  const hours = Math.max(1, Math.min(168, Math.round(input.staleThresholdHours)));
  await db
    .insert(adminSettings)
    .values({
      id: 1,
      alertEmail: email || null,
      notifySourceErrors: input.notifySourceErrors,
      notifySourceStale: input.notifySourceStale,
      notifyCookieExpiry: input.notifyCookieExpiry,
      staleThresholdHours: hours,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminSettings.id,
      set: {
        alertEmail: email || null,
        notifySourceErrors: input.notifySourceErrors,
        notifySourceStale: input.notifySourceStale,
        notifyCookieExpiry: input.notifyCookieExpiry,
        staleThresholdHours: hours,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function approveEvent(id: string) {
  await requireAdmin();
  await db
    .update(events)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(events.id, id));
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

export async function rejectEvent(id: string) {
  await requireAdmin();
  await db
    .update(events)
    .set({ status: "hidden", hiddenReason: "manual", updatedAt: new Date() })
    .where(eq(events.id, id));
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

/* Approve a /submit-form draft: insert the payload as a fresh
   approved event (source='manual', externalId=submission.id for
   provenance), then mark the submission row approved. Mirrors the
   magic-link /moderate flow so admin-UI and email-link paths produce
   identical results. */
export async function approveSubmission(id: string) {
  await requireAdmin();
  const [submission] = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.id, id))
    .limit(1);
  if (!submission || submission.status !== "pending") return;
  /* Source-suggestion rows route to a different approve path - they
     register as a scrape source row, not an event row. */
  if (isSourcePayload(submission.payload)) {
    const sourceUrl = submission.payload.url;
    const adapter = adapterForUrl(sourceUrl);
    /* requires_review=true so the FIRST round of scraped events from
       a newly-registered source go to the queue for admin sign-off
       before they show up publicly. Admin can toggle this off later
       once the source's quality is established. */
    await db.insert(sources).values({
      adapter,
      url: sourceUrl,
      enabled: true,
      requiresReview: true,
    });
    await db
      .update(pendingSubmissions)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(pendingSubmissions.id, id));
    revalidatePath("/admin/review");
    revalidatePath("/admin/sources");
    return;
  }
  const payload = submission.payload as SubmissionPayload;
  const startsAt = new Date(payload.startsAt);
  if (Number.isNaN(startsAt.getTime())) return;
  const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
  await db.insert(events).values({
    title: payload.title,
    description: payload.description,
    link: payload.link,
    source: "manual",
    externalId: submission.id,
    startsAt,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
    isOnline: payload.isOnline,
    venueName: payload.venueName,
    address: payload.address,
    city: payload.city,
    state: payload.state ?? "UT",
    postalCode: payload.postalCode,
    tags: payload.tags,
    status: "approved",
  });
  await db
    .update(pendingSubmissions)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(pendingSubmissions.id, id));
  revalidatePath("/admin/review");
  revalidatePath("/");
}

export async function rejectSubmission(id: string) {
  await requireAdmin();
  await db
    .update(pendingSubmissions)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(eq(pendingSubmissions.id, id));
  revalidatePath("/admin/review");
}

export async function restoreEvent(id: string) {
  /* Clear hiddenReason on restore so /admin/hidden chips don't lie
     about future re-hides (e.g. a craft event restored, then later
     re-rejected by admin should read 'manual' not 'craft'). */
  await requireAdmin();
  await db
    .update(events)
    .set({ status: "approved", hiddenReason: null, updatedAt: new Date() })
    .where(eq(events.id, id));
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

export async function toggleSourceEnabled(id: string, enabled: boolean) {
  await requireAdmin();
  await db.update(sources).set({ enabled }).where(eq(sources.id, id));
  revalidatePath("/admin/sources");
}

export async function toggleSourceRequiresReview(
  id: string,
  requiresReview: boolean,
) {
  await requireAdmin();
  await db.update(sources).set({ requiresReview }).where(eq(sources.id, id));
  revalidatePath("/admin/sources");
}
