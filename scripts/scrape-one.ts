import { runSourceScrape } from "@/lib/scrape-runner";
import { db, sources } from "@/lib/db";
import { isNull, eq, and } from "drizzle-orm";

/* Run the 4 not-yet-touched vertical sources sequentially without
   the full cron sweep. Lets us populate vertical tags now instead
   of waiting for the next 3h cron tick. */
const rows = await db
  .select({ id: sources.id, url: sources.url })
  .from(sources)
  .where(and(isNull(sources.lastScrapedAt), eq(sources.enabled, true)));

console.log(`scraping ${rows.length} never-scraped sources...`);
for (const r of rows) {
  const t = Date.now();
  try {
    const result = await runSourceScrape(r.id);
    const ms = Date.now() - t;
    console.log(`  ${result.status === "ok" ? "ok " : "ERR"} ${ms}ms  ${result.inserted}+${result.updated}u  ${r.url}`);
  } catch (e) {
    console.log(`  ERR ${Date.now() - t}ms  ${r.url}  ${e instanceof Error ? e.message : e}`);
  }
}
console.log("done");
