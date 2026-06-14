import type { Adapter, EventItem } from "../types";
import { fetchHtml, extractJsonLd } from "../next-data";

interface JsonLdEvent {
  "@type"?: string | string[];
  "@id"?: string;
  url?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventAttendanceMode?: string;
  image?: string | string[];
  location?:
    | {
        "@type"?: string;
        name?: string;
        address?:
          | {
              streetAddress?: string;
              addressLocality?: string;
              addressRegion?: string;
              postalCode?: string;
            }
          | string;
      }
    | Array<unknown>;
  organizer?: { name?: string };
}

function isEventType(t: string | string[] | undefined): boolean {
  if (!t) return false;
  if (Array.isArray(t)) return t.some(isEventType);
  return /Event/i.test(t);
}

function pickImage(image: string | string[] | undefined): string | undefined {
  if (!image) return undefined;
  return Array.isArray(image) ? image[0] : image;
}

function getLocation(loc: JsonLdEvent["location"]) {
  if (!loc) return null;
  const first = Array.isArray(loc) ? loc[0] : loc;
  if (!first || typeof first !== "object") return null;
  return first as { name?: string; address?: unknown };
}

function getAddress(loc: ReturnType<typeof getLocation>) {
  const raw = loc?.address;
  if (!raw) return {};
  if (typeof raw === "string") return { address: raw };
  if (typeof raw !== "object") return {};
  const a = raw as Record<string, string>;
  return {
    address: a.streetAddress,
    city: a.addressLocality,
    state: a.addressRegion,
    postalCode: a.postalCode,
  };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function normalize(node: JsonLdEvent): EventItem | null {
  if (!isEventType(node["@type"])) return null;
  if (!node.startDate || !node.name) return null;
  const startsAt = new Date(node.startDate);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endsAt = node.endDate ? new Date(node.endDate) : undefined;
  const link = node.url ?? node["@id"];
  if (!link) return null;
  const externalId = link;
  const loc = getLocation(node.location);
  const addr = getAddress(loc);
  const isOnline = node.eventAttendanceMode?.toLowerCase().includes("online") ?? false;

  return {
    source: "eventbrite",
    externalId,
    title: node.name,
    description: typeof node.description === "string" ? node.description : undefined,
    link,
    startsAt,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
    isOnline,
    venueName: loc?.name,
    address: addr.address,
    city: addr.city,
    postalCode: addr.postalCode,
    imageUrl: pickImage(node.image),
    groupName: node.organizer?.name,
  };
}

/* Find the best (fullest) Event node in a JSON-LD tree.
   Prefer ones whose startDate has a time component (not just YYYY-MM-DD). */
function findBestEvent(blocks: unknown[]): JsonLdEvent | null {
  let bestWithTime: JsonLdEvent | null = null;
  let bestDateOnly: JsonLdEvent | null = null;
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    const o = v as JsonLdEvent & Record<string, unknown>;
    if (isEventType(o["@type"]) && o.startDate && o.name) {
      if (!DATE_ONLY.test(o.startDate)) {
        if (!bestWithTime) bestWithTime = o;
      } else {
        if (!bestDateOnly) bestDateOnly = o;
      }
    }
    for (const k of Object.keys(o)) walk(o[k]);
  };
  for (const b of blocks) walk(b);
  return bestWithTime ?? bestDateOnly;
}

/* Fetch an individual event page to get full datetime when the search page
   only provided a date. Sleeps between calls to be polite to Eventbrite. */
async function enrichDateOnly(item: EventItem, delayMs: number): Promise<EventItem> {
  try {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const html = await fetchHtml(item.link);
    const blocks = extractJsonLd(html);
    const best = findBestEvent(blocks);
    if (!best || !best.startDate || DATE_ONLY.test(best.startDate)) return item;
    const fullStart = new Date(best.startDate);
    if (Number.isNaN(fullStart.getTime())) return item;
    const fullEnd = best.endDate ? new Date(best.endDate) : undefined;
    /* The search-listing JSON-LD frequently omits eventAttendanceMode and
       a full address; the detail page carries both. Upgrade them here so a
       Zoom-only listing isn't stored in-person with an empty venue. */
    const bestLoc = getLocation(best.location);
    const bestAddr = getAddress(bestLoc);
    const bestOnline = best.eventAttendanceMode?.toLowerCase().includes("online") ?? false;
    return {
      ...item,
      startsAt: fullStart,
      endsAt: fullEnd && !Number.isNaN(fullEnd.getTime()) ? fullEnd : item.endsAt,
      // Also upgrade venue/address/online/description if richer on the detail page
      description: item.description ?? (typeof best.description === "string" ? best.description : item.description),
      isOnline: item.isOnline || bestOnline,
      venueName: item.venueName ?? bestLoc?.name,
      address: item.address ?? bestAddr.address,
      city: item.city ?? bestAddr.city,
      postalCode: item.postalCode ?? bestAddr.postalCode,
    };
  } catch {
    return item; // best effort; keep original on failure
  }
}

export const eventbriteAdapter: Adapter<EventItem> = {
  name: "eventbrite",
  runtime: "fetch",
  async scrape({ url, maxItems = 30 }) {
    const html = await fetchHtml(url);
    const blocks = extractJsonLd(html);

    const seen = new Set<string>();
    const items: EventItem[] = [];
    /* externalIds whose JSON-LD startDate was genuinely date-only
       (YYYY-MM-DD, no time). Tracked from the raw payload instead of
       inferred from the parsed instant - a real 6pm America/Denver event
       maps to 00:00:00Z under MDT and would otherwise be mistaken for
       date-only, triggering a needless detail-page refetch. */
    const dateOnlyIds = new Set<string>();

    const walk = (v: unknown) => {
      if (!v || items.length >= maxItems) return;
      if (Array.isArray(v)) {
        for (const item of v) walk(item);
        return;
      }
      if (typeof v === "object") {
        const o = v as JsonLdEvent & Record<string, unknown>;
        const normalized = normalize(o);
        if (normalized && !seen.has(normalized.externalId)) {
          seen.add(normalized.externalId);
          items.push(normalized);
          if (typeof o.startDate === "string" && DATE_ONLY.test(o.startDate)) {
            dateOnlyIds.add(normalized.externalId);
          }
        }
        for (const k of Object.keys(o)) {
          walk((o as Record<string, unknown>)[k]);
        }
      }
    };
    for (const b of blocks) walk(b);

    /* When the source page lists events with date-only startDate (search
       pages do this), fetch the individual event page to get the true time.
       Sequential with a delay to be polite. */
    const enriched: EventItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (dateOnlyIds.has(item.externalId) && item.link) {
        enriched.push(await enrichDateOnly(item, i === 0 ? 0 : 300));
      } else {
        enriched.push(item);
      }
    }
    return enriched;
  },
};
