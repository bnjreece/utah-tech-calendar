import * as cheerio from "cheerio";
import { fetchHtml } from "../next-data";
import type { Adapter, EventItem } from "../types";

/* Utah Geek Events (utahgeekevents.com) is a small annual-conference
   non-profit. The /events/ index lists 3-5 upcoming events inline as
   plain HTML cards. Each card carries a heading (event title), a date
   string (`Saturday, September 19, 2026`), a time range, a short
   description, and a "More Information" link to the event's own site.

   Low volume but high signal: Kids Code Camp, Day of Data (formerly
   SQL Saturday), Big Mountain Data & Dev, Utah Code Camp. They're all
   recurring annually so the adapter pays off without much code. */

const INDEX_URL = "https://utahgeekevents.com/events/";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/* Build a UTC Date for a wall-clock instant in America/Denver. Uses
   Intl to grab the actual offset (handles DST), so a 9am Sept event
   is -06:00 (MDT) while a 9am Jan event is -07:00 (MST). */
function denverInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    timeZoneName: "shortOffset",
  }).formatToParts(utcMidnight);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-7";
  const m = name.match(/-(\d+)/);
  const offsetH = m ? parseInt(m[1], 10) : 7;
  return new Date(Date.UTC(year, month - 1, day, hour + offsetH, minute));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ParsedTime {
  start: { hour: number; minute: number };
  end?: { hour: number; minute: number };
}

/* "8:00 am - 5:30 pm" or "9:00am - 5:00pm" -> 24h pair. We assume the
   range stays within one local day, which holds for every event the
   site has ever listed. */
function parseTimeRange(raw: string): ParsedTime | null {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  const to24 = (h: number, ampm: string | undefined): number => {
    const lower = ampm?.toLowerCase();
    if (lower === "pm" && h < 12) return h + 12;
    if (lower === "am" && h === 12) return 0;
    return h;
  };
  const startH = to24(parseInt(m[1], 10), m[3] ?? m[6]);
  const startM = m[2] ? parseInt(m[2], 10) : 0;
  const endH = to24(parseInt(m[4], 10), m[6]);
  const endM = m[5] ? parseInt(m[5], 10) : 0;
  return { start: { hour: startH, minute: startM }, end: { hour: endH, minute: endM } };
}

const DATE_RE =
  /(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i;

export const utahGeekEventsAdapter: Adapter<EventItem> = {
  name: "utahGeekEvents",
  runtime: "fetch",
  async scrape({ maxItems = 30 }) {
    const html = await fetchHtml(INDEX_URL);
    const $ = cheerio.load(html);

    const items: EventItem[] = [];
    /* Each event is anchored on an <h1|h2|h3> heading. The site uses
       simple CMS templates so we look at all headings and skip the
       page title ("Events"). */
    const headings = $("main h1, main h2, main h3, .content h1, .content h2, .content h3, h1, h2, h3")
      .filter((_, el) => {
        const txt = $(el).text().trim();
        return txt.length > 0 && txt.toLowerCase() !== "events";
      })
      .toArray();

    const seen = new Set<string>();
    for (const headingEl of headings) {
      const heading = $(headingEl);
      const title = heading.text().trim().replace(/\s+/g, " ");
      if (!title) continue;

      /* The page uses <br>-separated text inside a parent <div>, so the
         heading's siblings are mostly empty <br> tags. We grab the full
         parent text and slice off the heading itself, leaving the date,
         time, description, and "More Information" link inline. */
      const parent = heading.parent();
      const fullText = parent.text().replace(/\s+/g, " ").trim();
      const headingText = title.replace(/\s+/g, " ").trim();
      let bodyText = fullText.startsWith(headingText)
        ? fullText.slice(headingText.length).trim()
        : fullText;
      /* The page top has a single "Events" h1 inside its own wrapper -
         skip cards whose parent only contains the heading. */
      if (!bodyText) continue;

      /* External "More Information" link lives inside the same parent. */
      const link = parent
        .find("a[href]")
        .toArray()
        .map((a) => $(a).attr("href"))
        .find((href) => href && /^https?:/.test(href) && !href.includes("utahgeekevents.com"));

      const dateMatch = bodyText.match(DATE_RE);
      if (!dateMatch) continue;
      const month = MONTHS[dateMatch[1].toLowerCase()];
      const day = parseInt(dateMatch[2], 10);
      const year = parseInt(dateMatch[3], 10);
      if (!month || !day || !year) continue;

      const time = parseTimeRange(bodyText);
      const startsAt = denverInstant(year, month, day, time?.start.hour ?? 9, time?.start.minute ?? 0);
      const endsAt = time?.end
        ? denverInstant(year, month, day, time.end.hour, time.end.minute)
        : undefined;

      const externalId = slugify(title);
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      /* Description = the body text minus the date/time line. */
      const description = bodyText
        .replace(DATE_RE, "")
        .replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, "")
        .replace(/More Information/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      items.push({
        source: "utah_geek_events",
        externalId,
        title: title.replace(/&amp;/g, "&"),
        description: description || undefined,
        link: link ?? INDEX_URL,
        startsAt,
        endsAt,
        isOnline: false,
        tags: ["conference"],
      });

      if (items.length >= maxItems) break;
    }

    return items;
  },
};
