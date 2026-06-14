/* Classify all unclassified upcoming events (events.llm_checked_at IS NULL)
   with the Phase-1 shadow classifier, in batches. Run once after setting
   ANTHROPIC_API_KEY to populate verdicts for the existing calendar so the
   agreement view has data immediately; the scrape cron then keeps up
   incrementally. Requires ANTHROPIC_API_KEY + DATABASE_URL in env:
     op run --env-file=.env.local -- bun scripts/classify-backlog.ts  */
import { classifyUnchecked } from "../src/lib/classify";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set - nothing to do.");
    process.exit(1);
  }
  let total = 0;
  for (;;) {
    const { scanned, classified } = await classifyUnchecked(25);
    total += classified;
    console.log(`batch: scanned ${scanned}, classified ${classified} (total ${total})`);
    if (scanned === 0) break;
    if (classified === 0) {
      console.warn("batch classified 0 of " + scanned + " - stopping to avoid a loop.");
      break;
    }
  }
  console.log(`Done. Classified ${total} events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
