import { htmlCalendarAdapter } from "@/lib/scrapers/adapters/html-calendar";

const targets = [
  "https://members.bioutah.org/events/calendar",
  "https://bioutah.growthzoneapp.com/communityeventscalendar",
  "https://altitudelab.org/events",
  "https://altitudelab.org/",
  "https://www.bsidesslc.org/",
  "https://saintcon.org/",
];

for (const url of targets) {
  try {
    const items = await htmlCalendarAdapter.scrape({ url, maxItems: 20 });
    console.log(`${url}: ${items.length} events`);
    for (const it of items.slice(0, 3)) {
      console.log(`  - ${it.title} @ ${it.startsAt.toISOString().slice(0,16)}`);
    }
  } catch (e) {
    console.log(`${url}: ERR ${e instanceof Error ? e.message : e}`);
  }
}
