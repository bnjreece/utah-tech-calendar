import * as cheerio from "cheerio";
import { fetchHtml } from "../next-data";
import type { Adapter, EventItem } from "../types";

/* Generic HTML calendar adapter. Reads schema.org/Event JSON-LD from
   any URL's <script type="application/ld+json"> blocks. Works for
   sites that already emit structured data (Eventbrite-hosted member
   pages, Squarespace/Wix calendars, WordPress events plugins, many
   conference sites). Does NOT work for hand-built sites that only
   show events as styled HTML without structured data - those need
   per-site CSS-selector adapters.

   What it covers in practice for utahtechcalendar.com:
   - BioUtah members/events calendar (uses schema.org/Event)
   - Altitude Lab events index
   - SAINTCON / BSidesSLC annual conf pages
   - Smaller meetup orgs with WordPress event plugins
   - Random org events pages that happen to have JSON-LD

   What it does NOT cover:
   - Sites with no structured data at all (return 0 items - clean
     failure, observable via /admin/sources lastStatus)
   - Sites that put events inline as styled cards without JSON-LD
     (need a tailored adapter like utah-geek-events.ts)

   Source.config knobs supported:
   - defaultTags: string[] - unioned in at upsert time (handled by
     scrape-runner, not here)
   - fallbackVenueName: string - applied when JSON-LD location is
     missing/incomplete
   - fallbackCity: string - same
   - skipIfTitleMatches: string - regex to reject obvious noise
   - sourceLabel: string - lets multiple HTML-calendar sources show
     different labels in /admin (e.g. "BioUtah" vs "Altitude Lab")
     while sharing the same adapter */

interface HtmlCalendarConfig {
  fallbackVenueName?: string;
  fallbackCity?: string;
  skipIfTitleMatches?: string;
  sourceLabel?: string;
}

interface JsonLdEvent {
  "@type"?: string | string[];
  "@id"?: string;
  name?: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  eventAttendanceMode?: string;
  eventStatus?: string;
  image?: string | string[] | { url?: string };
  location?: JsonLdLocation | JsonLdLocation[] | string;
  organizer?: { name?: string } | string;
}

interface JsonLdLocation {
  "@type"?: string;
  name?: string;
  address?:
    | string
    | {
        streetAddress?: string;
        addressLocality?: string;
        addressRegion?: string;
        postalCode?: string;
      };
  geo?: { latitude?: number | string; longitude?: number | string };
}

/* Walk a parsed JSON-LD payload of unknown shape and yield every
   Event-typed object found. Handles three common nesting patterns:
   1. A bare {"@type":"Event", ...} object at the root
   2. An array of such objects at the root
   3. A {"@graph": [...]} wrapper (common in WordPress JSON-LD plugins) */
function* walkJsonLdEvents(node: unknown): IterableIterator<JsonLdEvent> {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJsonLdEvents(item);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const isEvent =
    type === "Event" ||
    (Array.isArray(type) && type.some((t) => t === "Event"));
  if (isEvent) yield obj as JsonLdEvent;
  if ("@graph" in obj) yield* walkJsonLdEvents(obj["@graph"]);
}

function pickImage(image: JsonLdEvent["image"]): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : undefined;
  if (typeof image === "object" && image.url) return image.url;
  return undefined;
}

function pickLocation(loc: JsonLdEvent["location"]): JsonLdLocation | null {
  if (!loc) return null;
  if (typeof loc === "string") return { name: loc };
  if (Array.isArray(loc)) return loc[0] ?? null;
  return loc;
}

function safeDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/* Parse American-style microdata datetimes like "9/17/2026 5:30:00 PM"
   that GrowthZone-hosted calendars (BioUtah etc) emit in their
   itemprop="startDate" content attributes. Date.parse handles this
   format on V8/Node but not consistently across runtimes, so we
   parse manually as a fallback. Returns wall-clock UTC assuming the
   datetime is implicitly America/Denver - which is the case for every
   Utah-org calendar we target. */
const US_DATETIME_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;
function parseUsDenverDatetime(s: string): Date | undefined {
  const m = s.trim().match(US_DATETIME_RE);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  const ampm = m[7]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  /* Try both DST and standard offsets and pick the one whose UTC
     round-trips back to the input wall-clock in Denver - same trick
     used in utah-geek-events.ts for DST correctness. */
  for (const offsetH of [6, 7] as const) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hour + offsetH, minute, second));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
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
  /* DST gap fallback. */
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second));
}

function safeDateLenient(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  return safeDate(s) ?? parseUsDenverDatetime(s);
}

/* Walk schema.org/Event MICRODATA - the itemprop-attribute variant of
   structured data, used by GrowthZone-hosted Chamber of Commerce /
   industry-group calendars (BioUtah is one). Same vocabulary as JSON-
   LD, different delivery. We pull every element with
   itemtype="http://schema.org/Event" and read its itemprop children. */
function extractMicrodataEvents($: cheerio.CheerioAPI): JsonLdEvent[] {
  const out: JsonLdEvent[] = [];
  $('[itemtype$="schema.org/Event"]').each((_, root) => {
    const $root = $(root);
    const get = (prop: string): string | undefined => {
      /* :first not :first-of-type because we want the first
         descendant by document order, not the first child of its
         tag. content attribute wins over text - itemprop="startDate"
         lives on a <meta> tag whose visible text is empty. */
      const el = $root.find(`[itemprop="${prop}"]`).first();
      if (!el.length) return undefined;
      const content = el.attr("content");
      if (content) return content.trim();
      const src = el.attr("src") ?? el.attr("href");
      if (src) return src.trim();
      const text = el.text().trim();
      return text || undefined;
    };
    const name = get("name");
    const startRaw = get("startDate");
    if (!name || !startRaw) return;
    out.push({
      "@type": "Event",
      name,
      description: get("about") ?? get("description"),
      url: get("url"),
      startDate: startRaw,
      endDate: get("endDate"),
      image: get("image"),
    });
  });
  return out;
}

function normalize(event: JsonLdEvent, config: HtmlCalendarConfig, pageUrl: string): EventItem | null {
  const title = event.name?.trim();
  if (!title) return null;
  const startsAt = safeDateLenient(event.startDate);
  if (!startsAt) return null;
  /* eventStatus can suppress an item without removing it from the
     page - respect cancellations and postponements. */
  const status = event.eventStatus;
  if (typeof status === "string" && /Cancelled|Postponed/i.test(status)) return null;
  if (config.skipIfTitleMatches) {
    try {
      if (new RegExp(config.skipIfTitleMatches, "i").test(title)) return null;
    } catch {
      /* Bad regex in config - silently allow rather than crash the scrape. */
    }
  }
  const link = event.url ?? event["@id"] ?? pageUrl;
  /* externalId: prefer the event URL (stable cross-rescrape), fall
     back to a derived hash from title+startsAt+pageUrl when the
     JSON-LD omits url. */
  const externalId = event.url ?? event["@id"] ?? `${pageUrl}#${title}@${startsAt.toISOString()}`;
  const endsAt = safeDateLenient(event.endDate);
  const isOnline =
    typeof event.eventAttendanceMode === "string" &&
    /OnlineEventAttendanceMode/i.test(event.eventAttendanceMode);
  const location = pickLocation(event.location);
  /* Address can be a string or an object - normalize both. */
  let address: string | undefined;
  let city: string | undefined;
  let postalCode: string | undefined;
  if (location?.address) {
    if (typeof location.address === "string") {
      address = location.address;
    } else {
      address = location.address.streetAddress;
      city = location.address.addressLocality;
      postalCode = location.address.postalCode;
    }
  }
  const venueName = location?.name ?? config.fallbackVenueName;
  if (!city) city = config.fallbackCity;
  return {
    source: "html",
    externalId,
    title,
    description: event.description?.trim() || undefined,
    link,
    startsAt,
    endsAt,
    isOnline,
    venueName,
    address,
    city,
    postalCode,
    imageUrl: pickImage(event.image),
  };
}

export const htmlCalendarAdapter: Adapter<EventItem> = {
  name: "htmlCalendar",
  runtime: "fetch",
  async scrape({ url, maxItems, sourceConfig }) {
    const config = (sourceConfig as HtmlCalendarConfig | undefined) ?? {};
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    /* Collect every JSON-LD block on the page. Many sites split their
       structured data across multiple blocks (one for the organization,
       one for the event list, one for breadcrumbs). We don't care which
       block holds the events - we walk them all. */
    const blocks: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) blocks.push(text);
    });
    const events: EventItem[] = [];
    const seen = new Set<string>();
    /* JSON-LD first - more structured, more reliable for sites that
       emit it. Microdata is the fallback for sites that don't, and
       only kicks in if JSON-LD finds nothing (otherwise the same
       event would dedup via externalId but the cost adds up across
       large pages). */
    for (const raw of blocks) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const evt of walkJsonLdEvents(parsed)) {
        const item = normalize(evt, config, url);
        if (!item) continue;
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        events.push(item);
        if (maxItems && events.length >= maxItems) return events;
      }
    }
    if (events.length === 0) {
      for (const evt of extractMicrodataEvents($)) {
        const item = normalize(evt, config, url);
        if (!item) continue;
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        events.push(item);
        if (maxItems && events.length >= maxItems) return events;
      }
    }
    return events;
  },
};
