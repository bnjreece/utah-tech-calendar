/* Reports scrapers that are currently failing, for the Scraper Doctor
   workflow. Reuses the same health classification as /admin/health:
   a source is "broken" when its last run errored (lastError set).
   Writes broken-sources.json and sets GitHub Actions outputs
   has_broken + count so the workflow only spends Claude budget when
   there is actually something to fix. Run with DATABASE_URL in env. */
import { appendFileSync, writeFileSync } from "node:fs";
import { fetchSourceHealth } from "../src/lib/health-dashboard";

async function main() {
  const { sources, summary } = await fetchSourceHealth();
  const broken = sources.filter((s) => s.status === "broken");

  const report = broken.map((s) => ({
    id: s.id,
    name: s.name,
    host: s.host,
    url: s.url,
    lastError: s.lastError,
    errorRate7d: Math.round(s.errorRate7d * 100),
    runCount7d: s.runCount7d,
  }));

  writeFileSync("broken-sources.json", JSON.stringify(report, null, 2));

  console.log(
    `Fleet: ${summary.total} sources — ${summary.broken} broken, ${summary.stale} stale, ${summary.quiet} quiet, ${summary.ok} ok`,
  );
  for (const b of report) {
    console.log(`- ${b.name} (${b.host}) [${b.errorRate7d}% errors/7d]: ${b.lastError ?? "(no message)"}`);
  }

  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `has_broken=${broken.length > 0}\ncount=${broken.length}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
