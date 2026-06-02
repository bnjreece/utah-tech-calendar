import { htmlCalendarAdapter } from "@/lib/scrapers/adapters/html-calendar";
const items = await htmlCalendarAdapter.scrape({
  url: "https://bioutah.growthzoneapp.com/eventscalendar",
  maxItems: 10,
});
console.log(`${items.length} events from bioutah widget:`);
for (const i of items) console.log(`  ${i.title} | ${i.startsAt.toISOString().slice(0,16)} | ${i.link.slice(0,80)}`);
