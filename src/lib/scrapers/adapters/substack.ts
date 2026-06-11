import type { Adapter, EventItem } from "../types";
import { safeFetchHtml } from "@/lib/safe-fetch";

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

/* Return the Mountain-time UTC offset in minutes for a given month/day/year.
   Uses Intl over America/Denver so DST is honored (MDT = -6h Mar-Nov,
   MST = -7h Nov-Mar). The previous hardcoded -6h misplaced winter events
   by an hour. */
function denverOffsetMin(year: number, month: number, day: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    timeZoneName: "short",
  });
  const sample = new Date(Date.UTC(year, month, day, 18));
  const parts = dtf.formatToParts(sample);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "MST";
  return tz === "MDT" ? 6 * 60 : 7 * 60;
}

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
  /* Use matchAll so a post that recaps last month's event AND announces
     the next one doesn't pick the recap (past) and silently lose the
     upcoming one. We pick the FUTURE candidate first, then the closest
     to post date if all candidates are past. */
  const dateRe =
    /(\bjanuary|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b[,\s]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
  const matches = [...body.matchAll(dateRe)];
  if (matches.length === 0) return null;

  const postMs = pubDate.getTime();
  const nowMs = Date.now();

  type Candidate = { utc: number; diff: number };
  const allCandidates: Candidate[] = [];

  for (const m of matches) {
    const [, monStr, dayStr, hourStr, minStr, ampm] = m;
    const month = MONTHS[monStr.toLowerCase()];
    if (month === undefined) continue;
    const day = Number(dayStr);
    let hour = Number(hourStr);
    const minute = minStr ? Number(minStr) : 0;
    if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;

    for (const yearOffset of [0, 1, -1]) {
      const year = pubDate.getUTCFullYear() + yearOffset;
      const offsetMin = denverOffsetMin(year, month, day);
      const utc = Date.UTC(year, month, day, hour, minute) + offsetMin * 60_000;
      const diff = Math.abs(utc - postMs);
      if (diff <= 180 * 86_400_000) allCandidates.push({ utc, diff });
    }
  }

  if (allCandidates.length === 0) return null;

  /* Prefer the soonest FUTURE candidate; fall back to closest-to-post
     if no candidates are future. Past-event filter at the bottom drops
     a no-future-match result so we never poison the schedule with
     historical dates. */
  const futureCandidates = allCandidates
    .filter((c) => c.utc >= nowMs - 12 * 60 * 60 * 1000)
    .sort((a, b) => a.utc - b.utc);
  const best = futureCandidates[0];
  if (!best) return null;

  /* Venue heuristic: a capitalized phrase followed by " - " or " — "
     and a street number. Tightened to ~30 chars and anchored to a
     sentence boundary so it doesn't grab mid-clause prose. */
  let venue: string | undefined;
  const venueMatch = body.match(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9 '&]{2,30}?)\s*[-—]\s*\d+\s+[A-Z]/);
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
    /* SSRF-hardened: feedUrl derives from a community-influenced source
       URL, so resolve+validate the host before fetching. Returns the
       raw feed text (XML) the same way a direct fetch would. */
    const xml = await safeFetchHtml(feedUrl);
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
