"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, events, sources } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

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
