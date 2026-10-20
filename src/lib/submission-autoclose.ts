import { eq, sql } from "drizzle-orm";
import { db, adminSettings, pendingSubmissions } from "@/lib/db";
import { normalizeEventTitle, submissionPastDated, validDay } from "@/lib/autopilot";

/* Close /submit drafts that need no human: past-dated ones become 'expired',
   ones already on the calendar become 'duplicate'. Silent on purpose: this
   never calls rejectSubmission (that emails the submitter) and never
   approves anything. Both statuses are terminal for every reader, which all
   filter on status = 'pending'. Runs from the scrape cron; llm_gate_enabled
   is the kill switch, as for the event autopilot. */

type Payload = { type?: string; title?: string; link?: string; startsAt?: string };

type SubmissionCloseReason = "expired" | "duplicate";

/* Read-only: is this draft already on the public calendar? Only APPROVED
   events count: a pending scraped twin may still be held, screened or
   expire, and closing the human copy against it would lose the event. The
   match is the link or the normalized title, and either way the same Denver
   date (many recurring series reuse one link for every date). With no
   parseable date, only a link match on an upcoming event counts. */
export async function submissionDuplicate(payload: Payload): Promise<boolean> {
  const link = payload.link?.trim().replace(/\/+$/, "").toLowerCase() || null;
  /* The naive form value's date part is already the Denver date. */
  const day = validDay(payload.startsAt);
  const res = await db.execute(sql`
    SELECT title, (link IS NOT NULL AND rtrim(lower(link), '/') = ${link}) AS link_match
    FROM events
    WHERE status = 'approved'
      AND CASE WHEN ${day}::date IS NULL
        THEN starts_at >= now() AND link IS NOT NULL AND rtrim(lower(link), '/') = ${link}
        ELSE (starts_at AT TIME ZONE 'America/Denver')::date = ${day}::date
      END
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
    try {
      await closeOne(row, now, out);
    } catch (err) {
      /* One bad draft must not stop the rest; it stays pending for a human. */
      console.warn(
        "[submission-autoclose] skipped",
        row.id,
        err instanceof Error ? err.name : "unknown error",
      );
    }
  }
  return out;
}

async function closeOne(
  row: typeof pendingSubmissions.$inferSelect,
  now: Date,
  out: { expired: number; duplicate: number },
): Promise<void> {
  const payload = (row.payload ?? {}) as Payload;
  if (payload.type === "source") return;
  const status: SubmissionCloseReason | null = submissionPastDated(payload, now)
    ? "expired"
    : (await submissionDuplicate(payload))
      ? "duplicate"
      : null;
  if (!status) return;
  /* Status change and ledger row in one statement: both or neither. */
  const decision = status === "expired" ? "expire" : "duplicate";
  const snapshot = {
    payload: row.payload,
    submitterEmail: row.submitterEmail,
    submitterName: row.submitterName,
  };
  const res = await db.execute(sql`
    WITH upd AS (
      UPDATE pending_submissions SET status = ${status}, reviewed_at = now()
      WHERE id = ${row.id} AND status = 'pending'
        AND EXISTS (SELECT 1 FROM admin_settings WHERE id = 1 AND llm_gate_enabled)
      RETURNING id
    )
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, snapshot)
    SELECT 'submission_event', upd.id, ${decision}, NULL, 'pending', ${status},
      'autopilot', 'auto', NULL, NULL, ${JSON.stringify(snapshot)}::jsonb
    FROM upd
    RETURNING subject_id
  `);
  if ((Array.isArray(res) ? res : (res.rows ?? [])).length === 0) return;
  out[status]++;
}
