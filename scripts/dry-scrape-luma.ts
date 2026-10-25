/* Dry run of the Luma adapter against a live calendar: prints what a scrape
   would upsert, writes nothing. Usage:
   bun scripts/dry-scrape-luma.ts <calendar url> [maxItems] [--json] */
import { lumaAdapter } from "../src/lib/scrapers/adapters/luma";

const [, , url, max, flag] = process.argv;
if (!url) {
  console.log("Usage: bun scripts/dry-scrape-luma.ts <url> [maxItems] [--json]");
  process.exit(1);
}
const items = await lumaAdapter.scrape({ url, maxItems: Number(max) || 200 });
if (flag === "--json") {
  console.log(JSON.stringify(items, null, 2));
} else {
  console.log(`${items.length} items from ${url}`);
  for (const i of items) {
    console.log(
      [
        i.startsAt.toISOString().slice(0, 16),
        i.externalId,
        i.isOnline ? "ONLINE" : "",
        i.city ?? "-",
        i.description ? `desc:${i.description.length}` : "nodesc",
        i.imageUrl ? "img" : "noimg",
        i.title.slice(0, 50),
        i.link,
      ].join(" | "),
    );
  }
}
