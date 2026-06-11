/* Re-runs the cert-spam / craft hide heuristics over already-APPROVED
   events. The scrape pipeline only applies these on INSERT, so any event
   first seen before a regex improvement stays approved forever - this
   script closes that gap. Idempotent: safe to run anytime after
   tightening the patterns in scrape-runner.ts.

   Dry run by default (prints what it would hide); pass --commit to apply.
     op run --env-file=.env.local -- bun scripts/rescan-spam.ts
     op run --env-file=.env.local -- bun scripts/rescan-spam.ts --commit  */
import { and, eq, gte } from "drizzle-orm";
import { db, events } from "../src/lib/db";
import { detectPaid, detectCraft } from "../src/lib/scrape-runner";

async function main() {
  const commit = process.argv.includes("--commit");

  const rows = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, new Date())));

  const hits = rows.flatMap((r) => {
    const reason = detectPaid(r) ? "cert-spam" : detectCraft(r) ? "craft" : null;
    return reason ? [{ ...r, reason }] : [];
  });

  console.log(
    `Scanned ${rows.length} approved upcoming events - ${hits.length} match hide heuristics`,
  );
  for (const h of hits) console.log(`  [${h.reason}] ${h.title}`);

  if (!hits.length) return;
  if (!commit) {
    console.log("\nDry run. Re-run with --commit to hide these.");
    return;
  }

  for (const h of hits) {
    await db
      .update(events)
      .set({ status: "hidden", hiddenReason: h.reason })
      .where(eq(events.id, h.id));
  }
  console.log(`\nHid ${hits.length} events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
