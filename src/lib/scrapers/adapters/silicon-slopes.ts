import type { Adapter, EventItem } from "../types";
import { fetchHtml } from "../next-data";
import { mapPool, extractMetaDescription, clampDescription } from "../enrich";

/* Silicon Slopes publishes its Circle.so event list without authentication.
   Anonymous and authenticated requests return the same upcoming records.
   Keep this public feed independent of a user's expiring browser session. */

const ENDPOINT =
  "https://www.siliconslopes.com/internal_api/events/community_events";
const EVENTS_BASE = "https://www.siliconslopes.com/c/events";

interface CircleEventSettings {
  starts_at?: string;
  ends_at?: string;
  location_type?: "in_person" | "virtual" | "tbd";
  in_person_location?: string | null;
  virtual_location_url?: string | null;
}

interface CircleEvent {
  id: number | string;
  slug: string;
  name: string;
  status?: string;
  event_setting_attributes?: CircleEventSettings;
}

interface CircleResponse {
  count?: number;
  records?: CircleEvent[];
}

interface ParsedAddress {
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

/* "470 W 200 N, Salt Lake City, UT 84103" -> components. The Circle
   payload also includes lat/lng inside a `geometry` sub-object, but
   our event schema doesn't store it so we don't extract it. */
function parseInPersonLocation(raw: string | null | undefined): ParsedAddress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { formatted_address?: string };
    const formatted = parsed?.formatted_address;
    if (!formatted) return {};
    const m = formatted.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})(?:\s+(\d{5}))?/);
    if (m) {
      return {
        address: m[1].trim(),
        city: m[2].trim(),
        state: m[3].trim(),
        postalCode: m[4]?.trim(),
      };
    }
    return { address: formatted };
  } catch {
    return {};
  }
}

export const siliconSlopesAdapter: Adapter<EventItem> = {
  name: "siliconSlopes",
  runtime: "fetch",
  async scrape({ maxItems = 50 }) {
    const perPage = Math.min(Math.max(maxItems, 10), 50);
    const res = await fetch(`${ENDPOINT}?page=1&per_page=${perPage}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Circle API ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as CircleResponse;
    if (!data || !Array.isArray(data.records)) {
      throw new Error("Circle API response missing events records array");
    }
    const records = data.records;

    const items: EventItem[] = [];
    const seen = new Set<string>();
    for (const r of records) {
      const esa = r.event_setting_attributes;
      if (!esa?.starts_at) continue;
      const startsAt = new Date(esa.starts_at);
      if (Number.isNaN(startsAt.getTime())) continue;
      const externalId = r.slug || String(r.id);
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const endsAt = esa.ends_at ? new Date(esa.ends_at) : undefined;
      const isOnline = esa.location_type === "virtual";
      const location = isOnline ? {} : parseInPersonLocation(esa.in_person_location);
      /* Only stamp a venue/city when we actually resolved an in-person
         location. For location_type "tbd" (and in_person rows whose
         address failed to parse) leave venue + city undefined so the event
         buckets as location-unknown instead of a fabricated "Silicon
         Slopes / Salt Lake City" that misrepresents where it is. */
      const hasLocation = !isOnline && Boolean(location.address || location.city);

      items.push({
        source: "silicon_slopes",
        externalId,
        title: r.name,
        link: `${EVENTS_BASE}/${r.slug}`,
        startsAt,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
        isOnline,
        venueName: hasLocation ? "Silicon Slopes" : undefined,
        address: location.address,
        city: location.city,
        postalCode: location.postalCode,
      });
      if (items.length >= maxItems) break;
    }

    /* The community_events list API returns no body. Each event's PUBLIC
       page (no session cookie needed) renders the body summary into its
       og:description, so enrich from there - this is what gives Silicon
       Slopes events a description for the classifier and detail pages.
       Fails soft per-event: a failed fetch leaves the list data intact. */
    await mapPool(items, 6, async (item) => {
      if (item.description || !item.link) return;
      try {
        const html = await fetchHtml(item.link);
        const desc = clampDescription(extractMetaDescription(html));
        if (desc) item.description = desc;
      } catch {
        /* keep the event without a description */
      }
    });

    return items;
  },
};
