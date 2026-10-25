import { sql } from "drizzle-orm";
import { db, events, sources } from "@/lib/db";
import { eventSnapshot } from "@/lib/review-log";
import { normalizeEventTitle, type AutopilotDecision } from "@/lib/autopilot";
import { STALE_AFTER_MS } from "@/lib/same-day-twins";
import type { TwinEvidence } from "@/lib/queue-twins";
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

export interface DupOriginal {
  id: string;
  title: string;
}

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;

/* Rule 2 and the rule 5 series check, both read-only. Dates compare in SQL
   in America/Denver, never against a JS timestamp. `originals` lists the
   rows the duplicate defers to (id and title as read), so the write can
   recheck that one of them is still there (see applyPendingDecision). */
export async function pendingFacts(
  r: EventRow,
): Promise<{ duplicate: boolean; seriesCount: number; originals: DupOriginal[] }> {
  const sameDay = rowsOf<{ id: string; title: string; status: string }>(
    await db.execute(sql`
      SELECT o.id, o.title, o.status FROM events o, events me
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
  const originals =
    key === "" || PLACEHOLDER_TITLE_RE.test(key)
      ? []
      : sameDay.filter((o) => normalizeEventTitle(o.title) === key).map((o) => ({ id: o.id, title: o.title }));
  const duplicate = originals.length > 0;

  const [series] = rowsOf<{ n: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS n FROM events o, events me
      WHERE me.id = ${r.id} AND o.id <> me.id AND o.source_id = me.source_id
        AND o.created_at > now() - interval '30 days'
        AND btrim(lower(regexp_replace(o.title, '[^a-zA-Z0-9]+', ' ', 'g')))
          = btrim(lower(regexp_replace(me.title, '[^a-zA-Z0-9]+', ' ', 'g')))
    `),
  );
  return { duplicate, seriesCount: Number(series?.n ?? 0), originals };
}

const DUP_REASON = "autopilot:dup";

/* Tags as a jsonb parameter (SQL NULL for no array), so the guard compares
   the whole array in order. A bare JS array in a drizzle sql template
   renders as a parameter list, not an array. */
export function tagsJson(tags: string[] | null | undefined): string | null {
  return tags == null ? null : JSON.stringify(tags);
}

/* Apply a hide or publish as ONE statement: the UPDATE only matches while the
   row is still pending, unlocked, scraped, upcoming, the gate is still on and
   every column the classifier read is unchanged, tags included (they drive
   the crypto hold), so a human click or a re-scrape since classification
   makes it a no-op. The ledger row is
   inserted from the UPDATE's RETURNING, so both happen or neither does.
   A duplicate hide (autopilot:dup) also needs one of the `originals` it
   defers to still pending or approved, same Denver day, title unchanged,
   and a pending one still the older same-link listing. That check takes a
   FOR SHARE lock, so it cannot interleave with the queue-twin sweep hiding
   the original (applyQueueTwinHide holds the mirror lock): whichever
   commits first wins and the other finds its keeper gone, so two copies
   are never both hidden. Returns true when the row changed. */
export async function applyPendingDecision(
  r: EventRow,
  verdict: EventVerdict,
  d: AutopilotDecision,
  originals: DupOriginal[] = [],
): Promise<boolean> {
  if (d.action === "hold") return false;
  const publish = d.action === "publish";
  const newStatus = publish ? "approved" : "hidden";
  const hiddenReason = publish ? null : (d.hiddenReason ?? null);
  const dup = d.reason === DUP_REASON;
  if (dup && originals.length === 0) return false;
  const keeper = dup
    ? sql`keeper AS (
      SELECT k.id FROM events k, events me
      WHERE me.id = ${r.id}::uuid AND k.id <> me.id
        AND (k.id::text, k.title) IN (
          SELECT e->>'id', e->>'title' FROM jsonb_array_elements(${JSON.stringify(originals)}::jsonb) e)
        AND (k.starts_at AT TIME ZONE 'America/Denver')::date
          = (me.starts_at AT TIME ZONE 'America/Denver')::date
        AND (k.status = 'approved'
          OR (k.status = 'pending' AND (k.created_at, k.id) < (me.created_at, me.id)
            AND k.link IS NOT NULL AND rtrim(lower(k.link), '/') = rtrim(lower(me.link), '/')))
      FOR SHARE OF k
    ), `
    : sql``;
  const keeperGuard = dup ? sql`AND EXISTS (SELECT 1 FROM keeper)` : sql``;
  const res = await db.execute(sql`
    WITH ${keeper}upd AS (
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
        AND to_jsonb(tags) IS NOT DISTINCT FROM ${tagsJson(r.tags)}::jsonb
        ${keeperGuard}
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
   read, the gate is on, and the row it defers to (`keep`) is still pending
   or approved with its start, title, link, source and external id
   unchanged. A stale-relist hide (evidence "relist") also needs the hidden
   row still unseen by the scraper and the keeper still seen, so a re-scrape
   that refreshes the hidden row in between makes it a no-op. The keeper
   check takes a FOR SHARE lock, so a concurrent scrape that reschedules or
   renames the keeper either commits first (the recheck then fails and
   nothing is hidden) or waits until this statement commits. Returns true
   when the row changed. */
export async function applyQueueTwinHide(r: EventRow, keep: EventRow, evidence: TwinEvidence): Promise<boolean> {
  const staleSecs = Math.floor(STALE_AFTER_MS / 1000);
  const relist = evidence === "relist";
  const keeperSeen = relist
    ? sql`AND (k.source = 'manual' OR k.updated_at > now() - make_interval(secs => ${staleSecs}))`
    : sql``;
  const rowStale = relist ? sql`AND updated_at <= now() - make_interval(secs => ${staleSecs})` : sql``;
  const res = await db.execute(sql`
    WITH keeper AS (
      SELECT k.id FROM events k
      WHERE k.id = ${keep.id}::uuid
        AND k.id <> ${r.id}::uuid
        AND k.status IN ('pending', 'approved')
        AND k.starts_at = ${keep.startsAt.toISOString()}::timestamptz
        AND k.title IS NOT DISTINCT FROM ${keep.title}::text
        AND k.link IS NOT DISTINCT FROM ${keep.link}::text
        AND k.source IS NOT DISTINCT FROM ${keep.source}::text
        AND k.external_id IS NOT DISTINCT FROM ${keep.externalId}::text
        ${keeperSeen}
      FOR SHARE
    ), upd AS (
      UPDATE events
      SET status = 'hidden', hidden_reason = 'cross-post', updated_at = now()
      WHERE id = ${r.id}
        AND status = 'pending'
        AND status_locked = false
        AND source <> 'manual'
        AND starts_at > now()
        AND starts_at = ${r.startsAt.toISOString()}::timestamptz
        AND title IS NOT DISTINCT FROM ${r.title}::text
        AND link IS NOT DISTINCT FROM ${r.link}::text
        AND source IS NOT DISTINCT FROM ${r.source}::text
        AND external_id IS NOT DISTINCT FROM ${r.externalId}::text
        ${rowStale}
        AND EXISTS (SELECT 1 FROM keeper)
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
