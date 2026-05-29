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

export const eventbriteAdapter: Adapter<EventItem> = {
  name: "eventbrite",
  runtime: "fetch",
  async scrape({ url, maxItems = 30 }) {
    const html = await fetchHtml(url);
    const blocks = extractJsonLd(html);

    const seen = new Set<string>();
    const items: EventItem[] = [];

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
        }
        for (const k of Object.keys(o)) {
          walk((o as Record<string, unknown>)[k]);
        }
      }
    };
    for (const b of blocks) walk(b);
    return items;
  },
};
