import { eq, sql } from "drizzle-orm";
import { db, sources } from "../src/lib/db";
import { runSourceScrape } from "../src/lib/scrape-runner";
import { eventAdapters } from "../src/lib/scrapers";

async function main() {
  const [, , adapterName, url] = process.argv;

  if (!adapterName) {
    console.log("Usage: bun scripts/one-shot-scrape.ts <adapter> [url]");
    console.log("Adapters:", Object.keys(eventAdapters).join(", "));
    console.log("If url is omitted, runs all enabled sources for that adapter.");
    process.exit(1);
  }

  if (url) {
    const adapter = eventAdapters[adapterName];
    if (!adapter) {
      console.error("Unknown adapter:", adapterName);
      process.exit(1);
    }
    console.log(`Running ${adapterName} on ${url}...`);
    const items = await adapter.scrape({ url, maxItems: 10 });
    console.log(`Got ${items.length} items.`);
    for (const item of items) {
      console.log("  -", item.title, "@", item.startsAt.toISOString());
    }
    process.exit(0);
  }

  console.log(`Running all enabled ${adapterName} sources from DB...`);
  const rows = await db
    .select({ id: sources.id, url: sources.url })
    .from(sources)
    .where(sql`${sources.adapter} = ${adapterName} AND ${sources.enabled} = true`);

  for (const row of rows) {
    console.log(`\n→ ${row.url}`);
    const result = await runSourceScrape(row.id);
    console.log(`  status: ${result.status}, inserted: ${result.inserted}, updated: ${result.updated}`);
    if (result.error) console.log(`  error: ${result.error}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
