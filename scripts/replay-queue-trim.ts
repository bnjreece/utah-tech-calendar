/* Dry run of the queue trim rules over today's upcoming rows. READ ONLY
   (SELECTs only; never writes).
     op run --env-file=.env.local -- bun scripts/replay-queue-trim.ts
   1. Queue twins (lib/queue-twins.ts): the hides the dedup sweep would make,
      and, as an audit, every same-day title match across ALL upcoming
      pending + approved rows with whether it had identity evidence.
   2. Low-confidence yes: pending rows whose STORED verdict decidePending
      now hides as autopilot:lowconf-yes. */
import { and, asc, gt, inArray } from "drizzle-orm";
import { db, events } from "../src/lib/db";
import { decidePending } from "../src/lib/autopilot";
import { loadSourceUrls, pendingFacts } from "../src/lib/autopilot-db";
import { matchTitles, planQueueTwinHides, queueTwinEvidence } from "../src/lib/queue-twins";
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

  const short = (r: { id: string; status: string; title: string }) => `${r.id.slice(0, 8)} [${r.status}] ${r.title}`;
  console.log("\n=== 1. Queue twins: planned hides");
  const plan = planQueueTwinHides(rows);
  for (const h of plan) console.log(`  HIDE ${short(h.hide)}\n    keep ${short(h.keep)}  (${h.match})`);
  console.log(`  total ${plan.length}`);

  console.log("\n=== 1b. Audit: every same-day title match, any status");
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (mtDayKey(a.startsAt) !== mtDayKey(b.startsAt)) continue;
      const m = matchTitles(a.title, b.title);
      if (!m) continue;
      const ev = queueTwinEvidence(a, b, m);
      console.log(`  ${ev ? "TWIN " : "no-ev"} ${m.padEnd(9)} ${short(a)}\n                  ${short(b)}`);
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
