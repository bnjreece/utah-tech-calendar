import { eventbriteAdapter } from "@/lib/scrapers/adapters/eventbrite";
const items = await eventbriteAdapter.scrape({ url: "https://www.eventbrite.com/e/bsidesslc-2026-tickets-1839100231299", maxItems: 10 });
console.log(`${items.length} bsides events:`);
for (const i of items) console.log(`  ${i.title} | ${i.startsAt.toISOString().slice(0,16)}`);
