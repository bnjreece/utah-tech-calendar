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

/* Build a UTC Date for a wall-clock instant in America/Denver. The
   tempting one-shot version (probe Intl at the unmoved UTC and apply
   that offset) is wrong at DST transitions and at the local-day
   boundary: the probe point lands on the wrong calendar day or the
   wrong side of the transition, so the offset is off by an hour.

   The robust pattern is to try both candidate offsets (-6 MDT and -7
   MST) and pick the one whose resulting instant round-trips back to
   the input wall-clock when formatted in Denver. Exactly one will
   match outside the skipped/repeated DST hour; inside it we fall
   back to MDT, which is the common case at 9am conference start. */
function denverInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const parts = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
  for (const offsetH of [6, 7] as const) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hour + offsetH, minute));
    const p = parts(candidate);
    const get = (t: string) => p.find((x) => x.type === t)?.value;
    if (
      Number(get("year")) === year &&
      Number(get("month")) === month &&
      Number(get("day")) === day &&
      Number(get("hour")) === hour &&
      Number(get("minute")) === minute
    ) {
      return candidate;
    }
  }
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
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
   site has ever listed. If neither half has an am/pm marker we return
   null so the caller falls back to a sensible 9am default instead of
   producing inverted hours like 5am end / 9am start. */
function parseTimeRange(raw: string): ParsedTime | null {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  const startMer = m[3]?.toLowerCase();
  const endMer = m[6]?.toLowerCase();
  if (!startMer && !endMer) return null;
  const to24 = (h: number, ampm: string | undefined): number => {
    if (ampm === "pm" && h < 12) return h + 12;
    if (ampm === "am" && h === 12) return 0;
    return h;
  };
  /* Start inherits the end's marker when only the end has one (the
     "9 - 5pm" pattern); same in reverse. */
  const startH = to24(parseInt(m[1], 10), startMer ?? endMer);
  const startM = m[2] ? parseInt(m[2], 10) : 0;
  const endH = to24(parseInt(m[4], 10), endMer ?? startMer);
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

      /* Pin externalId to a stable core (event family + year) so the
         row keeps updating when the title decoration drifts. "Day of
         Data 2026 (Formerly SQL Saturday)" and "Day of Data 2026"
         both produce `day-of-data-2026` and re-target the same row.
         Drop parentheticals, drop any year-like token, then append
         the parsed year so the externalId is exactly one year long. */
      const normalizedTitle = title
        .replace(/\([^)]*\)/g, "")
        .replace(/\b20\d{2}\b/g, "")
        .trim();
      const externalId = `${slugify(normalizedTitle)}-${year}`.replace(/-+/g, "-");
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
