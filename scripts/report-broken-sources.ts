/* Reports scrapers that are currently failing, for the Scraper Doctor
   workflow. Reuses the same health classification as /admin/health:
   a source is "broken" when its last run errored (lastError set).
   Writes broken-sources.json and sets GitHub Actions outputs
   has_broken + count so the workflow only spends Claude budget when
   there is actually something to fix. Run with DATABASE_URL in env. */
import { appendFileSync, writeFileSync } from "node:fs";
import { fetchSourceHealth } from "../src/lib/health-dashboard";
import { fetchDriftedAdapters } from "../src/lib/scraper-drift";

async function main() {
  const [{ sources, summary }, drifted] = await Promise.all([
    fetchSourceHealth(),
    fetchDriftedAdapters(),
  ]);
  const broken = sources.filter((s) => s.status === "broken");

  const report = broken.map((s) => ({
    id: s.id,
    host: s.host,
    url: s.url,
    lastError: s.lastError,
    errorRate7d: Math.round(s.errorRate7d * 100),
    runCount7d: s.runCount7d,
  }));

  writeFileSync("broken-sources.json", JSON.stringify(report, null, 2));
  writeFileSync("drifted-adapters.json", JSON.stringify(drifted, null, 2));

  console.log(
    `Fleet: ${summary.total} sources — ${summary.broken} broken, ${summary.stale} stale, ${summary.quiet} quiet, ${summary.ok} ok`,
  );
  for (const b of report) {
    console.log(`- broken: ${b.host} [${b.errorRate7d}% errors/7d]: ${b.lastError ?? "(no message)"}`);
  }
  for (const d of drifted) {
    console.log(
      `- DRIFT: adapter "${d.adapter}" — ${d.regressedCount}/${d.sourcesWithHistory} sources dropped to 0 events (was producing). Likely upstream structure change.`,
    );
  }

  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(
      out,
      `has_broken=${broken.length > 0}\ncount=${broken.length}\n` +
        `has_drift=${drifted.length > 0}\ndrift_count=${drifted.length}\n` +
        `needs_fix=${broken.length > 0 || drifted.length > 0}\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
