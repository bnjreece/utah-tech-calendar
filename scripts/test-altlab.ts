import { lumaAdapter } from "@/lib/scrapers/adapters/luma";
const items = await lumaAdapter.scrape({ url: "https://lu.ma/altitudelab", maxItems: 10 });
console.log(`${items.length} altitudelab luma events:`);
for (const i of items) console.log(`  ${i.title} | ${i.startsAt.toISOString().slice(0,16)} | ${i.link.slice(0,80)}`);
