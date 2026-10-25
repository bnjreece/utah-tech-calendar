import type { Adapter, EventItem } from "../types";
import { fetchHtml, extractNextData } from "../next-data";
import { mapPool, flattenTiptap, clampDescription } from "../enrich";
import { parseIcs, type IcsEvent } from "../ics";
import { safeFetchHtml } from "@/lib/safe-fetch";

/* A Luma calendar page only carries lightweight event nodes (title, time,
   cover) - no body. Luma's public event endpoint returns the full event,
   whose `description_mirror` is the body as a tiptap document. We flatten
   it to text. Host is fixed (api.lu.ma) and we route through safeFetchHtml
   for the same SSRF/size/timeout guards every other scrape fetch uses.
   The same response carries the full event node, which is what fills in an
   event that only the calendar's ICS feed listed (see scrape below). */
interface LumaDetail {
  node?: LumaEventNode;
  description?: string;
}
async function fetchLumaDetail(apiId: string): Promise<LumaDetail | undefined> {
  try {
    const raw = await safeFetchHtml(
      `https://api.lu.ma/event/get?event_api_id=${encodeURIComponent(apiId)}`,
    );
    const data = JSON.parse(raw) as { event?: LumaEventNode; description_mirror?: unknown };
    return {
      node: data.event,
      description: clampDescription(flattenTiptap(data.description_mirror)),
    };
  } catch {
    return undefined;
  }
}

/* The calendar's ICS export lists EVERY event on the calendar, while the
   server-rendered page only carries the first ~20. Fixed host (api.lu.ma),
   the calendar id comes from the page's own data, and the fetch goes
   through the same guards. Returns null on any failure so the scrape falls
   back to the page's events. */
async function fetchCalendarIcs(calendarApiId: string): Promise<IcsEvent[] | null> {
  try {
    const raw = await safeFetchHtml(
      `https://api.lu.ma/ics/get?entity=calendar&id=${encodeURIComponent(calendarApiId)}`,
    );
    if (!raw.includes("BEGIN:VCALENDAR")) return null;
    return parseIcs(raw);
  } catch {
    return null;
  }
}

interface LumaEventNode {
  api_id?: string;
  name?: string;
  description_short?: string;
  description_md?: string;
  url?: string;
  start_at?: string;
  end_at?: string;
  cover_url?: string;
  geo_address_json?: {
    address?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    latitude?: string | number;
    longitude?: string | number;
  };
  geo_address_info?: {
    full_address?: string;
    city_state?: string;
    city?: string;
  };
  coordinate?: { latitude?: number; longitude?: number };
  location_type?: string;
  is_online_only?: boolean;
  meeting_url?: string;
  venue?: { name?: string; address?: string; city?: string };
  hosts?: Array<{ name?: string }>;
}

function deepFind<T>(node: unknown, predicate: (v: unknown) => boolean): T[] {
  const found: T[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (predicate(v)) found.push(v as T);
    if (Array.isArray(v)) for (const item of v) visit(item);
    else for (const k of Object.keys(v as Record<string, unknown>)) visit((v as Record<string, unknown>)[k]);
  };
  visit(node);
  return found;
}

function toUrl(input: string, base = "https://lu.ma"): string {
  if (input.startsWith("http")) return input;
  if (input.startsWith("/")) return `${base}${input}`;
  return `${base}/${input}`;
}

/* Luma's geo_address_json.city is often missing even when a full
   street address is present (e.g. venue strings like "Show Barn at
   Thanksgiving Point, 2975 S Thanksgiving Wy, Lehi, UT 84043"). Parse
   the standard "..., CITY, UT [ZIP]" tail to recover the city when
   the structured field is empty - means region categorization can
   actually route the event to Utah County instead of "Unknown". */
function extractCityFromAddress(addr: string | undefined | null): string | undefined {
  if (!addr) return undefined;
  const withZip = addr.match(/,\s*([A-Z][A-Za-z .'-]+?)\s*,\s*(?:UT|Utah)\s+\d{5}/);
  if (withZip) return withZip[1].trim();
  const noZip = addr.match(/,\s*([A-Z][A-Za-z .'-]+?)\s*,\s*(?:UT|Utah)\b/);
  if (noZip) return noZip[1].trim();
  return undefined;
}

function normalize(node: LumaEventNode): EventItem | null {
  if (!node.start_at || !node.name || !node.api_id) return null;
  const startsAt = new Date(node.start_at);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endsAt = node.end_at ? new Date(node.end_at) : undefined;
  const url = node.url ? toUrl(node.url) : `https://lu.ma/${node.api_id}`;
  const isOnline =
    Boolean(node.is_online_only) ||
    node.location_type === "online" ||
    (!node.geo_address_json && Boolean(node.meeting_url));
  const latRaw = node.geo_address_json?.latitude ?? node.coordinate?.latitude;
  const lngRaw = node.geo_address_json?.longitude ?? node.coordinate?.longitude;
  const latitude = typeof latRaw === "string" ? Number(latRaw) : latRaw;
  const longitude = typeof lngRaw === "string" ? Number(lngRaw) : lngRaw;

  return {
    source: "luma",
    externalId: node.api_id,
    title: node.name,
    description: node.description_short ?? node.description_md,
    link: url,
    startsAt,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
    isOnline,
    venueName: node.venue?.name ?? node.geo_address_info?.full_address,
    address: node.geo_address_json?.address ?? node.geo_address_info?.full_address,
    city:
      node.geo_address_json?.city ??
      node.venue?.city ??
      extractCityFromAddress(node.geo_address_info?.full_address) ??
      extractCityFromAddress(node.venue?.address) ??
      extractCityFromAddress(node.geo_address_json?.address) ??
      node.geo_address_info?.city,
    postalCode: node.geo_address_json?.postal_code,
    latitude: Number.isFinite(latitude) ? (latitude as number) : undefined,
    longitude: Number.isFinite(longitude) ? (longitude as number) : undefined,
    imageUrl: node.cover_url,
  };
}

const LUMA_LINK_RE = /^https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\//i;
const HTTP_RE = /^https?:\/\//i;

/* Build an event from an ICS entry alone. Used for the entries the page
   did not carry; a detail fetch then upgrades the Luma-hosted ones.
   Two kinds of entry:
   - evt-... : a Luma event. Same id the page and the detail endpoint use,
     so re-scrapes keep updating one row.
   - calev-... : an external listing added to the calendar (the organizer
     links out to Eventbrite, a summit site, etc). Its id is the calendar
     entry's own stable id; its link is the external URL from LOCATION, or
     the calendar itself when there is none. */
export function icsToItem(ev: IcsEvent, calendarUrl: string): EventItem | null {
  const externalId = ev.uid.replace(/@.*$/, "").trim();
  if (!externalId || !ev.summary) return null;
  if (ev.status === "CANCELLED") return null;
  const loc = ev.location;
  const locIsUrl = Boolean(loc && HTTP_RE.test(loc));
  const hasGeo = ev.latitude !== undefined && ev.longitude !== undefined;
  const base = {
    source: "luma",
    externalId,
    /* External listings carry a decorative "↗︎" ("Zero Gravity Summit ↗︎ Day 1"). */
    title: ev.summary.replace(/\s*[\u2197\u2B08][\uFE0E\uFE0F]?\s*/g, " ").trim(),
    startsAt: ev.start,
    endsAt: ev.end && ev.end.getTime() >= ev.start.getTime() ? ev.end : undefined,
    latitude: ev.latitude,
    longitude: ev.longitude,
  };
  if (!externalId.startsWith("evt-")) {
    return {
      ...base,
      link: loc && locIsUrl && !LUMA_LINK_RE.test(loc) ? loc : calendarUrl,
      /* A listing with a pin on the map is a place; one without is not. */
      isOnline: !hasGeo,
      venueName: loc && !locIsUrl ? loc : undefined,
      address: loc && !locIsUrl ? loc : undefined,
      city: loc && !locIsUrl ? extractCityFromAddress(loc) : undefined,
      description: ev.organizerName ? `Hosted by ${ev.organizerName}.` : undefined,
    };
  }
  /* "Get up-to-date information at: https://luma.com/<slug>" is the
     event's public page. Kept on lu.ma, the host the page scrape uses. */
  const info = ev.description?.match(/https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\/([A-Za-z0-9_-]+)/);
  const hosted = ev.description?.match(/Hosted by ([^\n]+)/);
  return {
    ...base,
    link: info ? `https://lu.ma/${info[1]}` : `https://lu.ma/event/${externalId}`,
    /* LOCATION is a luma.com/event URL both for online events and for
       in-person ones whose address is shown only to guests. GEO tells
       them apart: only a physical event has a pin. */
    isOnline: locIsUrl && !hasGeo,
    venueName: loc && !locIsUrl ? loc : undefined,
    address: loc && !locIsUrl ? loc : undefined,
    city: loc && !locIsUrl ? extractCityFromAddress(loc) : undefined,
    description: hosted ? `Hosted by ${hosted[1].trim()}.` : undefined,
  };
}

/* Keep the ICS entries that have not ended yet, soonest first. */
function upcomingIcs(entries: IcsEvent[], now: Date): IcsEvent[] {
  return entries
    .filter((e) => (e.end ?? e.start).getTime() >= now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function calendarApiIdOf(data: unknown): string | undefined {
  const init = (data as { props?: { pageProps?: { initialData?: unknown } } })?.props?.pageProps
    ?.initialData as { kind?: string; data?: { calendar?: { api_id?: unknown } } } | undefined;
  if (init?.kind !== "calendar") return undefined;
  const id = init.data?.calendar?.api_id;
  return typeof id === "string" && /^cal-[A-Za-z0-9]+$/.test(id) ? id : undefined;
}

export const lumaAdapter: Adapter<EventItem> = {
  name: "luma",
  runtime: "fetch",
  async scrape({ url, maxItems = 20 }) {
    const html = await fetchHtml(url);
    const data = extractNextData<unknown>(html);
    if (!data) return [];

    const candidates = deepFind<LumaEventNode>(data, (v) => {
      if (!v || typeof v !== "object") return false;
      const o = v as Record<string, unknown>;
      return Boolean(o.api_id) && Boolean(o.start_at) && Boolean(o.name);
    });

    const pageItems = new Map<string, EventItem>();
    for (const c of candidates) {
      const item = normalize(c);
      if (!item || pageItems.has(item.externalId)) continue;
      pageItems.set(item.externalId, item);
    }

    /* A calendar page (not a discover/city page) also has an ICS feed with
       every event on it. Use it as the list, soonest first, keeping the
       richer page node where the page has one. Page-only nodes keep their
       place after the ICS ones. Without a feed this is the old behavior. */
    const items: EventItem[] = [];
    const icsOnly = new Set<EventItem>();
    const calId = calendarApiIdOf(data);
    const ics = calId ? await fetchCalendarIcs(calId) : null;
    if (ics) {
      for (const ev of upcomingIcs(ics, new Date())) {
        const id = ev.uid.replace(/@.*$/, "").trim();
        const fromPage = pageItems.get(id);
        if (fromPage) {
          items.push(fromPage);
          pageItems.delete(id);
          continue;
        }
        const item = icsToItem(ev, url);
        if (!item || items.some((i) => i.externalId === item.externalId)) continue;
        items.push(item);
        icsOnly.add(item);
      }
    }
    items.push(...pageItems.values());
    if (items.length > maxItems) items.length = maxItems;

    /* Enrich each Luma event with its body (and, for an ICS-only entry,
       its full node: cover, venue, city, page URL). The list data never
       carries a body, so this is what gives Luma events a real description.
       Fails soft - an event keeps its list data if its detail fetch errors
       (marked partial when that list data is the ICS feed's).
       Four lanes keep a large calendar from bursting the API. */
    await mapPool(items, 4, async (item) => {
      if (!item.externalId.startsWith("evt-")) return;
      const fromIcs = icsOnly.has(item);
      if (item.description && !fromIcs) return;
      const detail = await fetchLumaDetail(item.externalId);
      /* An ICS-only event without its detail is list data only (a "Hosted
         by" stub for a body, no cover). Mark it so a rescrape that hits a
         rate limit does not overwrite what an earlier full scrape stored. */
      const full =
        fromIcs && detail?.node ? normalize({ ...detail.node, api_id: item.externalId }) : null;
      if (fromIcs && !full) item.partial = true;
      if (!detail) return;
      if (full) {
        /* The feed's times and location stay the fallback for anything
           the node lacks. */
        for (const [k, v] of Object.entries(full)) {
          if (v !== undefined && v !== null && v !== "") (item as unknown as Record<string, unknown>)[k] = v;
        }
      }
      if (detail.description) item.description = detail.description;
    });

    return items;
  },
};
