import type { Adapter, EventItem } from "../types";
import { fetchHtml, extractNextData } from "../next-data";

interface MeetupVenue {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

interface MeetupEventNode {
  id?: string;
  title?: string;
  description?: string;
  eventUrl?: string;
  dateTime?: string;
  endTime?: string;
  eventType?: string; // "PHYSICAL" | "ONLINE" | "HYBRID"
  venue?: MeetupVenue | null;
  imageUrl?: string;
  group?: { urlname?: string; name?: string };
}

function deepFind<T>(node: unknown, predicate: (v: unknown) => boolean): T[] {
  const found: T[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (predicate(v)) found.push(v as T);
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
    } else {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        visit((v as Record<string, unknown>)[k]);
      }
    }
  };
  visit(node);
  return found;
}

function normalize(node: MeetupEventNode, fallbackGroupUrl?: string): EventItem | null {
  if (!node.dateTime || !node.title || !node.eventUrl) return null;
  const startsAt = new Date(node.dateTime);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endsAt = node.endTime ? new Date(node.endTime) : undefined;
  /* eventType is PHYSICAL | ONLINE | HYBRID. ONLINE is always online;
     HYBRID counts as online only when there is NO physical-location signal
     at all - name, address, city, or coordinates. A hybrid with any real
     venue still has an in-person option worth showing on the schedule.
     (Meetup sometimes returns a partial venue with just a city or coords.) */
  const hasPhysicalVenue = Boolean(
    node.venue?.name || node.venue?.address || node.venue?.city || node.venue?.lat,
  );
  const isOnline =
    node.eventType === "ONLINE" ||
    (node.eventType === "HYBRID" && !hasPhysicalVenue);
  const externalId = node.id ?? node.eventUrl;
  const groupExternalId =
    node.group?.urlname ?? fallbackGroupUrl?.split("/").filter(Boolean).pop();

  return {
    source: "meetup",
    externalId,
    title: node.title,
    description: node.description,
    link: node.eventUrl,
    startsAt,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
    isOnline,
    venueName: node.venue?.name,
    address: node.venue?.address,
    city: node.venue?.city,
    postalCode: node.venue?.postalCode,
    latitude: node.venue?.lat,
    longitude: node.venue?.lng,
    imageUrl: node.imageUrl,
    groupName: node.group?.name,
    groupExternalId,
  };
}

export const meetupAdapter: Adapter<EventItem> = {
  name: "meetup",
  runtime: "fetch",
  async scrape({ url, maxItems = 20 }) {
    const html = await fetchHtml(url);
    const data = extractNextData<unknown>(html);
    if (!data) return [];

    const candidates = deepFind<MeetupEventNode>(data, (v) => {
      if (!v || typeof v !== "object") return false;
      const o = v as Record<string, unknown>;
      return Boolean(o.dateTime) && Boolean(o.eventUrl) && Boolean(o.title);
    });

    const seen = new Set<string>();
    const items: EventItem[] = [];
    for (const c of candidates) {
      const item = normalize(c, url);
      if (!item) continue;
      if (seen.has(item.externalId)) continue;
      seen.add(item.externalId);
      items.push(item);
      if (items.length >= maxItems) break;
    }
    return items;
  },
};
