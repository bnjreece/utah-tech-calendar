import { sql } from "drizzle-orm";
import { db, events, sources } from "@/lib/db";
import { eventSnapshot } from "@/lib/review-log";
import { normalizeEventTitle, type AutopilotDecision } from "@/lib/autopilot";
import type { EventVerdict } from "@/lib/verdict";

/* DB side of the queue autopilot (lib/autopilot.ts holds the pure rules).
   Reads gather the facts decidePending needs; applyPendingDecision is the
   only write. */

type EventRow = typeof events.$inferSelect;

function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
}

export async function loadSourceUrls(): Promise<Map<string, string>> {
  const rows = await db.select({ id: sources.id, url: sources.url }).from(sources);
  return new Map(rows.map((s) => [s.id, s.url]));
}

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;

/* Rule 2 and the rule 5 series check, both read-only. Dates compare in SQL
   in America/Denver, never against a JS timestamp. */
export async function pendingFacts(
  r: EventRow,
): Promise<{ duplicate: boolean; seriesCount: number }> {
  const sameDay = rowsOf<{ title: string }>(
    await db.execute(sql`
      SELECT o.title FROM events o, events me
      WHERE me.id = ${r.id} AND o.id <> me.id
        AND (o.starts_at AT TIME ZONE 'America/Denver')::date
          = (me.starts_at AT TIME ZONE 'America/Denver')::date
        AND (o.status = 'approved'
          /* An unreviewed pending row only counts as the original when it
             is the same listing (same link). Otherwise a junk twin could
             hide the good copy and then be hidden itself. */
          OR (o.status = 'pending' AND (o.created_at, o.id) < (me.created_at, me.id)
            AND o.link IS NOT NULL AND rtrim(lower(o.link), '/') = rtrim(lower(me.link), '/')))
    `),
  );
  const key = normalizeEventTitle(r.title);
  /* Placeholder titles ("TBD") from different groups are not cross-posts. */
  const duplicate =
    key !== "" && !PLACEHOLDER_TITLE_RE.test(key) && sameDay.some((o) => normalizeEventTitle(o.title) === key);

  const [series] = rowsOf<{ n: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS n FROM events o, events me
      WHERE me.id = ${r.id} AND o.id <> me.id AND o.source_id = me.source_id
        AND o.created_at > now() - interval '30 days'
        AND btrim(lower(regexp_replace(o.title, '[^a-zA-Z0-9]+', ' ', 'g')))
          = btrim(lower(regexp_replace(me.title, '[^a-zA-Z0-9]+', ' ', 'g')))
    `),
  );
  return { duplicate, seriesCount: Number(series?.n ?? 0) };
}

/* Apply a hide or publish as ONE statement: the UPDATE only matches while the
   row is still pending, unlocked, scraped, upcoming, the gate is still on and
   every column the classifier read is unchanged (so a human click or a
   re-scrape since classification makes it a no-op). The ledger row is
   inserted from the UPDATE's RETURNING, so both happen or neither does.
   Returns true when the row changed. */
export async function applyPendingDecision(
  r: EventRow,
  verdict: EventVerdict,
  d: AutopilotDecision,
): Promise<boolean> {
  if (d.action === "hold") return false;
  const publish = d.action === "publish";
  const newStatus = publish ? "approved" : "hidden";
  const hiddenReason = publish ? null : (d.hiddenReason ?? null);
  const res = await db.execute(sql`
    WITH upd AS (
      UPDATE events
      SET status = ${newStatus}, hidden_reason = ${hiddenReason}, updated_at = now()
      WHERE id = ${r.id}
        AND status = 'pending'
        AND status_locked = false
        AND source <> 'manual'
        AND starts_at > now()
        AND title IS NOT DISTINCT FROM ${r.title}::text
        AND description IS NOT DISTINCT FROM ${r.description}::text
        AND venue_name IS NOT DISTINCT FROM ${r.venueName}::text
        AND city IS NOT DISTINCT FROM ${r.city}::text
        AND link IS NOT DISTINCT FROM ${r.link}::text
        AND is_online IS NOT DISTINCT FROM ${r.isOnline}::boolean
        AND source_id IS NOT DISTINCT FROM ${r.sourceId}::uuid
        AND EXISTS (SELECT 1 FROM admin_settings WHERE id = 1 AND llm_gate_enabled)
      RETURNING id, source_id, source
    )
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, llm_verdict, snapshot)
    SELECT 'scraped_event', upd.id, ${publish ? "approve" : "hide"}, ${d.reason},
      'pending', ${newStatus}, 'autopilot', 'auto', upd.source_id, upd.source,
      ${JSON.stringify(verdict)}::jsonb, ${JSON.stringify(eventSnapshot(r))}::jsonb
    FROM upd
    RETURNING subject_id
  `);
  return rowsOf(res).length > 0;
}

/* Hide a pending queue twin (lib/queue-twins.ts) in ONE statement, chained
   to its ledger row like applyPendingDecision. Only matches while the row
   is still pending, unlocked, scraped, upcoming and unchanged since it was
   read, the row it defers to is still pending or approved, and the gate is
   on. Returns true when the row changed. */
export async function applyQueueTwinHide(r: EventRow, keepId: string): Promise<boolean> {
  const res = await db.execute(sql`
    WITH upd AS (
      UPDATE events
      SET status = 'hidden', hidden_reason = 'cross-post', updated_at = now()
      WHERE id = ${r.id}
        AND id <> ${keepId}::uuid
        AND status = 'pending'
        AND status_locked = false
        AND source <> 'manual'
        AND starts_at > now()
        AND starts_at = ${r.startsAt.toISOString()}::timestamptz
        AND title IS NOT DISTINCT FROM ${r.title}::text
        AND venue_name IS NOT DISTINCT FROM ${r.venueName}::text
        AND city IS NOT DISTINCT FROM ${r.city}::text
        AND link IS NOT DISTINCT FROM ${r.link}::text
        AND EXISTS (SELECT 1 FROM events k WHERE k.id = ${keepId}::uuid AND k.status IN ('pending', 'approved'))
        AND EXISTS (SELECT 1 FROM admin_settings WHERE id = 1 AND llm_gate_enabled)
      RETURNING id, source_id, source, llm_verdict
    )
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, llm_verdict, snapshot)
    SELECT 'scraped_event', upd.id, 'hide', 'autopilot:queue-dup',
      'pending', 'hidden', 'autopilot', 'auto', upd.source_id, upd.source,
      upd.llm_verdict, ${JSON.stringify(eventSnapshot(r))}::jsonb
    FROM upd
    RETURNING subject_id
  `);
  return rowsOf(res).length > 0;
}
