import type { Adapter, EventItem } from "../types";
import { fetchHtml, extractNextData } from "../next-data";
import { mapPool, flattenTiptap, clampDescription } from "../enrich";
import { safeFetchHtml } from "@/lib/safe-fetch";

/* A Luma calendar page only carries lightweight event nodes (title, time,
   cover) - no body. Luma's public event endpoint returns the full event,
   whose `description_mirror` is the body as a tiptap document. We flatten
   it to text. Host is fixed (api.lu.ma) and we route through safeFetchHtml
   for the same SSRF/size/timeout guards every other scrape fetch uses. */
async function fetchLumaDescription(apiId: string): Promise<string | undefined> {
  try {
    const raw = await safeFetchHtml(
      `https://api.lu.ma/event/get?event_api_id=${encodeURIComponent(apiId)}`,
    );
    const data = JSON.parse(raw) as { description_mirror?: unknown };
    return clampDescription(flattenTiptap(data.description_mirror));
  } catch {
    return undefined;
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
  };
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
  const isOnline = Boolean(node.is_online_only) || (!node.geo_address_json && Boolean(node.meeting_url));
  const latRaw = node.geo_address_json?.latitude;
  const lngRaw = node.geo_address_json?.longitude;
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
      extractCityFromAddress(node.geo_address_json?.address),
    postalCode: node.geo_address_json?.postal_code,
    latitude: Number.isFinite(latitude) ? (latitude as number) : undefined,
    longitude: Number.isFinite(longitude) ? (longitude as number) : undefined,
    imageUrl: node.cover_url,
  };
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

    const seen = new Set<string>();
    const items: EventItem[] = [];
    for (const c of candidates) {
      const item = normalize(c);
      if (!item) continue;
      if (seen.has(item.externalId)) continue;
      seen.add(item.externalId);
      items.push(item);
      if (items.length >= maxItems) break;
    }

    /* Enrich each event with its body. The list nodes never carry one, so
       this is what gives Luma events a real description (fails soft - an
       event keeps its list data if its detail fetch errors). */
    await mapPool(items, 5, async (item) => {
      if (item.description) return;
      const desc = await fetchLumaDescription(item.externalId);
      if (desc) item.description = desc;
    });

    return items;
  },
};
