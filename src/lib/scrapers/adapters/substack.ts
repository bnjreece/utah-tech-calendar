import type { Adapter, EventItem } from "../types";

/* Substack-as-event-source. Each substack post that announces a monthly
   event (Utah Burger Club pattern) gets parsed into an EventItem:

   - Post title carries the event month: "Utah Burger Club - May 2026"
   - Post body carries the date/time + venue in prose

   If the body cannot be parsed into a real date the post is skipped, not
   pushed as a half-formed event. Each substack+title-pattern combo lives
   in its own source row so we can add Luke G's burger club AND a different
   substack later without conflating them. */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8,
  sept: 8, oct: 9, nov: 10, dec: 11,
};

const MOUNTAIN_OFFSET_MIN = 6 * 60;

interface SubstackPost {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  guid: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(s: string): string {
  return decodeEntities(
    s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

function firstMatch(s: string, pattern: RegExp): string | null {
  const r = s.match(pattern);
  return r ? r[1] ?? null : null;
}

function parseRssItems(xml: string): SubstackPost[] {
  const items: SubstackPost[] = [];
  /* matchAll lets us iterate item blocks without a stateful regex. */
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const titleRaw = firstMatch(block, /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkRaw = firstMatch(block, /<link>([\s\S]*?)<\/link>/);
    const pubRaw = firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    if (!titleRaw || !linkRaw || !pubRaw) continue;
    const pubDate = new Date(pubRaw);
    if (Number.isNaN(pubDate.getTime())) continue;
    const contentRaw =
      firstMatch(block, /<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/) ??
      firstMatch(block, /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ??
      "";
    const description = stripHtml(contentRaw);
    const guid = stripHtml(firstMatch(block, /<guid[^>]*>([\s\S]*?)<\/guid>/) ?? linkRaw);
    items.push({
      title: stripHtml(titleRaw),
      link: stripHtml(linkRaw),
      pubDate,
      description,
      guid,
    });
  }
  return items;
}

/* Find a concrete date+time+venue in a post body. Returns null if nothing
   parseable is found. Designed for prose like:
     "Burger Fusion - 544 S 700 E, SLC ... May 27th at 1:00 pm"

   Year inference is anchored to the POST date, not to now: a post written
   on 2026-04-01 saying "April 15" means April 15 2026 even if today is
   2026-05-30. If the inferred date sits more than ~90d outside the post
   window we treat the regex hit as a false positive and skip. Past events
   (already happened relative to now) are also skipped so historical posts
   in the feed don't pollute the schedule. */
function parseEventDetails(body: string, pubDate: Date): { startsAt: Date; venue?: string } | null {
  const dateMatch = body.match(
    /(\bjanuary|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b[,\s]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!dateMatch) return null;
  const [, monStr, dayStr, hourStr, minStr, ampm] = dateMatch;
  const month = MONTHS[monStr.toLowerCase()];
  if (month === undefined) return null;
  const day = Number(dayStr);
  let hour = Number(hourStr);
  const minute = minStr ? Number(minStr) : 0;
  if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;

  /* Anchor year to the post date, then nudge ±1 year if needed to land
     within a ~6-month window of the post (covers posts written about
     events 0-90 days ahead). */
  const postMs = pubDate.getTime();
  const candidates = [
    Date.UTC(pubDate.getUTCFullYear(), month, day, hour, minute) + MOUNTAIN_OFFSET_MIN * 60_000,
    Date.UTC(pubDate.getUTCFullYear() + 1, month, day, hour, minute) + MOUNTAIN_OFFSET_MIN * 60_000,
    Date.UTC(pubDate.getUTCFullYear() - 1, month, day, hour, minute) + MOUNTAIN_OFFSET_MIN * 60_000,
  ];
  const best = candidates
    .map((utc) => ({ utc, diff: Math.abs(utc - postMs) }))
    .sort((a, b) => a.diff - b.diff)[0];
  if (best.diff > 180 * 86_400_000) return null;

  /* Drop past events. The schedule is forward-looking only. */
  if (best.utc < Date.now() - 12 * 60 * 60 * 1000) return null;

  let venue: string | undefined;
  const venueMatch = body.match(/([A-Z][A-Za-z0-9 '&-]{2,40})\s*[-—]\s*\d+\s+\w/);
  if (venueMatch) venue = venueMatch[1].trim();

  return { startsAt: new Date(best.utc), venue };
}

function buildExternalId(guid: string): string {
  return guid.replace(/^https?:\/\//, "").slice(0, 120);
}

export const substackAdapter: Adapter<EventItem> = {
  name: "substack",
  runtime: "fetch",
  async scrape({ url, maxItems = 12 }) {
    const feedUrl = url.endsWith("/feed") ? url : `${url.replace(/\/$/, "")}/feed`;
    const res = await fetch(feedUrl, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`substack feed ${res.status} ${feedUrl}`);
    const xml = await res.text();
    const posts = parseRssItems(xml);

    const items: EventItem[] = [];
    for (const post of posts.slice(0, maxItems)) {
      const parsed = parseEventDetails(post.description, post.pubDate);
      if (!parsed) continue;
      items.push({
        source: "substack",
        externalId: buildExternalId(post.guid),
        title: post.title,
        description: post.description.slice(0, 800),
        link: post.link,
        startsAt: parsed.startsAt,
        isOnline: false,
        venueName: parsed.venue,
        city: "Salt Lake City",
      });
    }
    return items;
  },
};
