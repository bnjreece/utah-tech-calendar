import type { Adapter, EventItem } from "../types";
import { fetchHtml } from "../next-data";
import { mapPool, extractMetaDescription, clampDescription } from "../enrich";

/* Silicon Slopes runs on Circle.so. They expose an internal JSON API at
   /internal_api/events/community_events that returns the same upcoming
   events the SPA renders, no JS execution required. We send the user's
   session cookie as a regular HTTP cookie header.

   This replaces an earlier puppeteer-core + sparticuz/chromium adapter
   that was tripping Cloudflare's bot fingerprinting from Vercel Lambda
   IPs. Plain fetch has no fingerprint attack surface, runs ~50x faster,
   needs ~128MB instead of 1GB, and ships no Chromium binary. */

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
    const rawCookie = process.env.SILICON_SLOPES_SESSION_COOKIE;
    if (!rawCookie) {
      throw new Error(
        "SILICON_SLOPES_SESSION_COOKIE missing - rotate via 1Password",
      );
    }
    /* Strip CR/LF in case a paste from 1Password picks up trailing
       whitespace - protects against header-injection if the env value
       is ever corrupted upstream. */
    const cookie = rawCookie.replace(/[\r\n]/g, "");
    const perPage = Math.min(Math.max(maxItems, 10), 50);
    const res = await fetch(`${ENDPOINT}?page=1&per_page=${perPage}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Cookie: `user_session_identifier=${cookie}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Circle API ${res.status} - session cookie likely expired`);
    }
    if (!res.ok) {
      throw new Error(`Circle API ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as CircleResponse;
    const records = data.records ?? [];

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
