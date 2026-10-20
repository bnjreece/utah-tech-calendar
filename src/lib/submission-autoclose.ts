import { and, eq, sql } from "drizzle-orm";
import { db, adminSettings, pendingSubmissions } from "@/lib/db";
import { recordSubmissionDecision } from "@/lib/review-log";
import { normalizeEventTitle, submissionPastDated } from "@/lib/autopilot";

/* Close /submit drafts that need no human: past-dated ones become 'expired',
   ones already on the calendar become 'duplicate'. Silent on purpose: this
   never calls rejectSubmission (that emails the submitter) and never
   approves anything. Both statuses are terminal for every reader, which all
   filter on status = 'pending'. Runs from the scrape cron; llm_gate_enabled
   is the kill switch, as for the event autopilot. */

type Payload = { type?: string; title?: string; link?: string; startsAt?: string };

type SubmissionCloseReason = "expired" | "duplicate";

/* Read-only: is this draft already an approved or pending event? Matches the
   link, or the normalized title on the same Denver date. Hidden events do not
   count, so a draft is never closed against something nobody can see. */
export async function submissionDuplicate(payload: Payload): Promise<boolean> {
  const link = payload.link?.trim().replace(/\/+$/, "").toLowerCase() || null;
  /* The naive form value's date part is already the Denver date. */
  const day = /^\d{4}-\d{2}-\d{2}/.exec(payload.startsAt ?? "")?.[0] ?? null;
  const res = await db.execute(sql`
    SELECT title, (link IS NOT NULL AND rtrim(lower(link), '/') = ${link}) AS link_match
    FROM events
    WHERE status IN ('approved', 'pending')
      AND ((link IS NOT NULL AND rtrim(lower(link), '/') = ${link})
        OR (${day}::date IS NOT NULL
          AND (starts_at AT TIME ZONE 'America/Denver')::date = ${day}::date))
  `);
  const rows = (Array.isArray(res) ? res : (res.rows ?? [])) as Array<{
    title: string;
    link_match: boolean;
  }>;
  const key = normalizeEventTitle(payload.title ?? "");
  return rows.some((r) => r.link_match || (key !== "" && normalizeEventTitle(r.title) === key));
}

export async function closeStaleSubmissions(): Promise<{ expired: number; duplicate: number }> {
  const out = { expired: 0, duplicate: 0 };
  const [settings] = await db
    .select({ enabled: adminSettings.llmGateEnabled })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  if (!settings?.enabled) return out;

  const rows = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.status, "pending"));
  const now = new Date();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Payload;
    if (payload.type === "source") continue;
    const status: SubmissionCloseReason | null = submissionPastDated(payload, now)
      ? "expired"
      : (await submissionDuplicate(payload))
        ? "duplicate"
        : null;
    if (!status) continue;
    const [claimed] = await db
      .update(pendingSubmissions)
      .set({ status, reviewedAt: now })
      .where(and(eq(pendingSubmissions.id, row.id), eq(pendingSubmissions.status, "pending")))
      .returning({ id: pendingSubmissions.id });
    if (!claimed) continue;
    await recordSubmissionDecision(row, status === "expired" ? "expire" : "duplicate", {
      subjectType: "submission_event",
      newStatus: status,
      decidedBy: "autopilot",
      channel: "auto",
    });
    out[status]++;
  }
  return out;
}
