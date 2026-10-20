/* Dry run of the queue autopilot over today's pending queue, using each
   row's STORED verdict. READ ONLY: it only runs SELECTs (pendingFacts and
   submissionDuplicate are reads) and never calls applyPendingDecision.
     op run --env-file=.env.local -- bun scripts/replay-autopilot.ts
   Prints what decidePending would do with AUTOPILOT_PUBLISH off and on,
   simulating the per-run publish cap in 25-row ticks. */
import { and, asc, eq, gt } from "drizzle-orm";
import { db, events, pendingSubmissions } from "../src/lib/db";
import { decidePending, submissionPastDated, type AutopilotDecision } from "../src/lib/autopilot";
import { loadSourceUrls, pendingFacts } from "../src/lib/autopilot-db";
import { submissionDuplicate } from "../src/lib/submission-autoclose";
import type { EventVerdict } from "../src/lib/verdict";

const TICK = 25;

async function main() {
  const now = new Date();
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "pending"), gt(events.startsAt, now)))
    .orderBy(asc(events.createdAt), asc(events.id));
  const urls = await loadSourceUrls();
  const facts = await Promise.all(rows.map((r) => pendingFacts(r)));

  for (const publishEnabled of [false, true]) {
    const out = new Map<string, string[]>();
    let published = 0;
    rows.forEach((r, i) => {
      if (i % TICK === 0) published = 0;
      const v = r.llmVerdict as EventVerdict | null;
      const d: AutopilotDecision = v
        ? decidePending(r, v, {
            now,
            sourceUrl: (r.sourceId && urls.get(r.sourceId)) || null,
            ...facts[i],
            publishEnabled,
            publishedThisRun: published,
          })
        : { action: "hold", reason: "hold:no-verdict" };
      if (d.action === "publish") published++;
      const conf = v ? Number(v.confidence).toFixed(2) : "-";
      const key = `${d.action.toUpperCase()} ${d.reason}`;
      out.set(key, [...(out.get(key) ?? []), `${conf}  ${r.source.padEnd(14)} ${r.title}`]);
    });
    const count = (a: string) =>
      [...out].filter(([k]) => k.startsWith(a)).reduce((n, [, t]) => n + t.length, 0);
    console.log(
      `\n=== AUTOPILOT_PUBLISH=${publishEnabled ? "on" : "off"}: ${rows.length} pending | publish ${count("PUBLISH")} | hide ${count("HIDE")} | hold ${count("HOLD")}`,
    );
    for (const [k, titles] of [...out].sort()) {
      console.log(`\n${k} (${titles.length})`);
      for (const t of titles.sort()) console.log(`  ${t}`);
    }
  }

  const subs = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.status, "pending"));
  console.log(`\n=== Submissions: ${subs.length} pending`);
  for (const s of subs) {
    const p = (s.payload ?? {}) as { type?: string; title?: string; startsAt?: string; link?: string };
    const verdict =
      p.type === "source"
        ? "keep (source suggestion)"
        : submissionPastDated(p, now)
          ? "expired"
          : (await submissionDuplicate(p))
            ? "duplicate"
            : "keep (human)";
    console.log(`  ${verdict.padEnd(24)} ${p.startsAt ?? ""}  ${p.title ?? "(untitled)"}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
