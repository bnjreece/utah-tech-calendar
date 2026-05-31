"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, events, sources, adminSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

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
    .set({ status: "hidden", updatedAt: new Date() })
    .where(eq(events.id, id));
  revalidatePath("/admin/review");
  revalidatePath("/admin/hidden");
  revalidatePath("/");
}

export async function restoreEvent(id: string) {
  await approveEvent(id);
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
