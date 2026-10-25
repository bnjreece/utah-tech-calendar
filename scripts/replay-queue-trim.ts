/* Dry run of the queue trim rules over today's upcoming rows. READ ONLY
   (SELECTs only; never writes).
     op run --env-file=.env.local -- bun scripts/replay-queue-trim.ts
   1. Queue twins (lib/queue-twins.ts): the hides the dedup sweep would make,
      and, as an audit, every same-day pair across ALL upcoming pending +
      approved rows that shares a listing id or a normalized title + start
      minute, any source, with each row's freshness (updated_at within 2
      days; informational, it only ranks the keeper of one listing).
   2. Low-confidence yes: pending rows whose STORED verdict decidePending
      now hides as autopilot:lowconf-yes. */
import { and, asc, gt, inArray } from "drizzle-orm";
import { db, events } from "../src/lib/db";
import { decidePending } from "../src/lib/autopilot";
import { loadSourceUrls, pendingFacts } from "../src/lib/autopilot-db";
import { listingKey, planQueueTwinHides, type QueueTwinRow } from "../src/lib/queue-twins";
import { STALE_AFTER_MS } from "../src/lib/same-day-twins";
import { mtDayKey } from "../src/lib/time";
import type { EventVerdict } from "../src/lib/verdict";

async function main() {
  const now = new Date();
  const rows = await db
    .select()
    .from(events)
    .where(and(inArray(events.status, ["pending", "approved"]), gt(events.startsAt, now)))
    .orderBy(asc(events.startsAt), asc(events.id));
  const pending = rows.filter((r) => r.status === "pending");
  console.log(`${rows.length} upcoming rows (${pending.length} pending)`);

  const fresh = (r: QueueTwinRow) => now.getTime() - r.updatedAt.getTime() < STALE_AFTER_MS;
  const plainTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const short = (r: QueueTwinRow) =>
    `${r.id.slice(0, 8)} [${r.status}] ${r.source} ${fresh(r) ? "fresh" : "STALE"} ${r.title}`;
  console.log("\n=== 1. Queue twins: planned hides");
  const plan = planQueueTwinHides(rows, now);
  for (const h of plan) console.log(`  HIDE ${short(h.hide)}\n    keep ${short(h.keep)}  (same listing)`);
  console.log(`  total ${plan.length}`);

  console.log("\n=== 1b. Audit: same-day pairs sharing a listing id, or a title + start minute");
  const planned = new Set(plan.map((h) => h.hide.id));
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (mtDayKey(a.startsAt) !== mtDayKey(b.startsAt)) continue;
      const k = listingKey(a.link);
      const sameId = k !== null && k === listingKey(b.link);
      const sameTitle = a.startsAt.getTime() === b.startsAt.getTime() && plainTitle(a.title) === plainTitle(b.title);
      if (!sameId && !sameTitle) continue;
      const hit = planned.has(a.id) || planned.has(b.id) ? "HIDE " : "human";
      console.log(`  ${hit} ${sameId ? `id ${k}` : "title+start"}\n      ${short(a)}\n      ${short(b)}`);
    }

  console.log("\n=== 2. Low-confidence yes (stored verdicts)");
  const urls = await loadSourceUrls();
  let n = 0;
  for (const r of pending) {
    const v = r.llmVerdict as EventVerdict | null;
    if (!v) continue;
    const d = decidePending(r, v, {
      now,
      sourceUrl: (r.sourceId && urls.get(r.sourceId)) || null,
      ...(await pendingFacts(r)),
      publishEnabled: process.env.AUTOPILOT_PUBLISH === "on",
      publishedThisRun: 0,
    });
    if (d.reason === "autopilot:lowconf-yes") {
      n++;
      console.log(`  HIDE ${Number(v.confidence).toFixed(2)} ${r.id} ${r.source.padEnd(11)} ${r.title}`);
    }
  }
  console.log(`  total ${n}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
