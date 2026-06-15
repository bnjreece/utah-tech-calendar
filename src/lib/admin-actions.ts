"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, events, sources, adminSettings, pendingSubmissions, groups } from "@/lib/db";
import type { SubmissionPayload } from "@/lib/submission-payload";
import { requireAdmin } from "@/lib/admin-auth";
import { recordEventDecision, recordSubmissionDecision } from "@/lib/review-log";
import { notifySubmitterEvent, notifySubmitterSource } from "@/lib/submitter-followup";
import { absoluteUrl } from "@/lib/seo";
import { eventSlug, toSlug } from "@/lib/slugs";

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
  notifyGateAnomaly: boolean;
  gateAnomalyThreshold: number;
}

export async function saveAdminSettings(input: AdminSettingsInput) {
  await requireAdmin();
  const email = (input.alertEmail || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid alert email");
  }
  const hours = Math.max(1, Math.min(168, Math.round(input.staleThresholdHours)));
  const gateThreshold = Math.max(
    1,
    Math.min(1000, Math.round(input.gateAnomalyThreshold) || 40),
  );
  const values = {
    alertEmail: email || null,
    notifySourceErrors: input.notifySourceErrors,
    notifySourceStale: input.notifySourceStale,
    notifyCookieExpiry: input.notifyCookieExpiry,
    staleThresholdHours: hours,
    notifyGateAnomaly: input.notifyGateAnomaly,
    gateAnomalyThreshold: gateThreshold,
    updatedAt: new Date(),
  };
  await db
    .insert(adminSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: adminSettings.id, set: values });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function approveEvent(id: string) {
  const admin = await requireAdmin();
  const [before] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  await db
    .update(events)
    .set({ status: "approved", statusLocked: true, updatedAt: new Date() })
    .where(eq(events.id, id));
  if (before) {
    await recordEventDecision(before, "approve", {
      newStatus: "approved",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
  }
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

export async function rejectEvent(id: string) {
  const admin = await requireAdmin();
  const [before] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  await db
    .update(events)
    .set({ status: "hidden", hiddenReason: "manual", statusLocked: true, updatedAt: new Date() })
    .where(eq(events.id, id));
  if (before) {
    await recordEventDecision(before, "reject", {
      newStatus: "hidden",
      reason: "manual",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
  }
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
  const admin = await requireAdmin();
  const [submission] = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.id, id))
    .limit(1);
  if (!submission || submission.status !== "pending") return;
  /* Atomically claim the row so two concurrent approvals can't both
     insert + log. Gating the UPDATE on status='pending' means only the
     winner proceeds; the event INSERT below is also backstopped by the
     events(source, external_id) unique index. */
  const [claimed] = await db
    .update(pendingSubmissions)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(
      and(eq(pendingSubmissions.id, id), eq(pendingSubmissions.status, "pending")),
    )
    .returning({ id: pendingSubmissions.id });
  if (!claimed) return;
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
    await recordSubmissionDecision(submission, "approve", {
      subjectType: "submission_source",
      newStatus: "approved",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
    /* Best-effort - any failure here just logs and continues. */
    try {
      await notifySubmitterSource({
        submitterEmail: submission.submitterEmail,
        submitterName: submission.submitterName,
        url: sourceUrl,
        decision: "approved",
      });
    } catch (err) {
      console.warn("[admin] submitter source approval email failed", err);
    }
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
    /* Human approval - lock it so the LLM gate can't re-screen it. */
    statusLocked: true,
  });
  const [inserted] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.externalId, submission.id))
    .limit(1);
  await recordSubmissionDecision(submission, "approve", {
    subjectType: "submission_event",
    newStatus: "approved",
    decidedBy: admin.email,
    channel: "admin-ui",
  });
  try {
    await notifySubmitterEvent({
      submitterEmail: submission.submitterEmail,
      submitterName: submission.submitterName,
      title: payload.title,
      decision: "approved",
      publishedUrl: inserted
        ? absoluteUrl(`/event/${eventSlug(inserted.title, inserted.id)}`)
        : undefined,
    });
  } catch (err) {
    console.warn("[admin] submitter event approval email failed", err);
  }
  revalidatePath("/admin/review");
  revalidatePath("/");
}

export async function rejectSubmission(id: string) {
  const admin = await requireAdmin();
  const [submission] = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.id, id))
    .limit(1);
  const [claimed] = await db
    .update(pendingSubmissions)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(
      and(eq(pendingSubmissions.id, id), eq(pendingSubmissions.status, "pending")),
    )
    .returning({ id: pendingSubmissions.id });
  if (!claimed) return;
  if (submission) {
    await recordSubmissionDecision(submission, "reject", {
      subjectType: isSourcePayload(submission.payload)
        ? "submission_source"
        : "submission_event",
      newStatus: "rejected",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
  }
  /* Notify submitter of the rejection. Distinguishes event vs
     source by payload type so the body copy fits. */
  if (submission && submission.submitterEmail) {
    try {
      if (isSourcePayload(submission.payload)) {
        await notifySubmitterSource({
          submitterEmail: submission.submitterEmail,
          submitterName: submission.submitterName,
          url: submission.payload.url,
          decision: "rejected",
        });
      } else {
        const p = submission.payload as SubmissionPayload;
        await notifySubmitterEvent({
          submitterEmail: submission.submitterEmail,
          submitterName: submission.submitterName,
          title: p.title ?? "(untitled draft)",
          decision: "rejected",
        });
      }
    } catch (err) {
      console.warn("[admin] submitter rejection email failed", err);
    }
  }
  revalidatePath("/admin/review");
}

export async function restoreEvent(id: string) {
  /* Clear hiddenReason on restore so /admin/hidden chips don't lie
     about future re-hides (e.g. a craft event restored, then later
     re-rejected by admin should read 'manual' not 'craft'). The prior
     hiddenReason is preserved in the ledger snapshot below. */
  const admin = await requireAdmin();
  const [before] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  await db
    .update(events)
    .set({ status: "approved", hiddenReason: null, statusLocked: true, updatedAt: new Date() })
    .where(eq(events.id, id));
  if (before) {
    await recordEventDecision(before, "restore", {
      newStatus: "approved",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
  }
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

/* From /admin/screened: the admin disagrees with an auto-screen and wants
   a human to decide it - move it into the review queue and lock it so the
   router won't re-screen it. */
export async function sendEventToReview(id: string) {
  const admin = await requireAdmin();
  const [before] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  await db
    .update(events)
    .set({ status: "pending", statusLocked: true, updatedAt: new Date() })
    .where(eq(events.id, id));
  if (before) {
    await recordEventDecision(before, "restore", {
      newStatus: "pending",
      reason: "sent-to-review",
      decidedBy: admin.email,
      channel: "admin-ui",
    });
  }
  revalidatePath("/admin/screened");
  revalidatePath("/admin/review");
  revalidatePath("/");
}

/* Master kill-switch + confidence bar for the LLM hard-gate. Form-driven:
   `enabled` is a checkbox, `threshold` a 0.5-1.0 number. */
export async function saveLlmGate(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const threshold = Math.max(
    0.5,
    Math.min(1, Number(formData.get("threshold")) || 0.92),
  );
  await db
    .insert(adminSettings)
    .values({
      id: 1,
      llmGateEnabled: enabled,
      llmGateThreshold: String(threshold),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminSettings.id,
      set: {
        llmGateEnabled: enabled,
        llmGateThreshold: String(threshold),
        updatedAt: new Date(),
      },
    });
  revalidatePath("/admin/screened");
  revalidatePath("/admin");
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

/* ── Group curation (admin only) ───────────────────────────────────
   Groups are the community/org behind events. These let an admin keep
   the user-facing Group filter clean: rename, merge duplicates, or
   delete an aggregator/junk group (which ungroups its events + sources
   rather than deleting them). */

function revalidateGroups() {
  revalidatePath("/admin/groups");
  revalidatePath("/"); // the Group filter on the home page
}

export async function renameGroup(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!id || !name) return;
  await db.update(groups).set({ name }).where(eq(groups.id, id));
  revalidateGroups();
}

/* Delete a group WITHOUT deleting its events: null the references on
   events + sources first, then remove the group row. The events stay
   on the calendar, just ungrouped. */
export async function deleteGroup(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.update(events).set({ groupId: null }).where(eq(events.groupId, id));
  await db.update(sources).set({ groupId: null }).where(eq(sources.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
  revalidateGroups();
}

/* Merge `fromId` into `intoId`: reassign all its events + sources to
   the target group, then delete the now-empty source group. */
export async function mergeGroups(formData: FormData) {
  await requireAdmin();
  const fromId = String(formData.get("fromId") ?? "");
  const intoId = String(formData.get("intoId") ?? "");
  if (!fromId || !intoId || fromId === intoId) return;
  await db.update(events).set({ groupId: intoId }).where(eq(events.groupId, fromId));
  await db.update(sources).set({ groupId: intoId }).where(eq(sources.groupId, fromId));
  await db.delete(groups).where(eq(groups.id, fromId));
  revalidateGroups();
}

/* Resolve a group-picker choice to a target group id (or null = none).
   "__new__" + newName creates the group (or reuses an existing slug). */
async function resolveGroupChoice(groupId: string, newName: string): Promise<string | null> {
  if (groupId === "__new__") {
    const name = newName.trim().slice(0, 120);
    if (!name) return null;
    const slug = toSlug(name);
    const [existing] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, slug)).limit(1);
    if (existing) return existing.id;
    const [created] = await db
      .insert(groups)
      .values({ name, slug, source: "manual" })
      .returning({ id: groups.id });
    return created?.id ?? null;
  }
  if (groupId && groupId !== "none" && groupId !== "") return groupId;
  return null;
}

/* Assign a SOURCE to a group (durable): the scraper re-applies
   source.groupId on every run, so this propagates to the source's
   events on the next scrape and survives. Also the create-a-group path
   that fixes "new sources have no group". */
export async function setSourceGroup(formData: FormData) {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  const target = await resolveGroupChoice(
    String(formData.get("groupId") ?? ""),
    String(formData.get("newGroupName") ?? ""),
  );
  await db.update(sources).set({ groupId: target }).where(eq(sources.id, sourceId));
  revalidatePath("/admin/sources");
  revalidateGroups();
}

/* Assign a single EVENT to a group and LOCK it so re-scrape won't
   overwrite the choice. Works immediately for manual events (no source)
   and for one-off overrides of scraped events. */
export async function setEventGroup(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;
  const target = await resolveGroupChoice(
    String(formData.get("groupId") ?? ""),
    String(formData.get("newGroupName") ?? ""),
  );
  await db.update(events).set({ groupId: target, groupLocked: true }).where(eq(events.id, eventId));
  revalidatePath("/admin/recent");
  revalidateGroups();
}
