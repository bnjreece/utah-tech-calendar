import { NextRequest } from "next/server";
import { parseFilters, type FilterState } from "@/lib/filters";
import { queryEvents, getRecentlyAddedEvents } from "@/lib/queries";
import { eventsToRss } from "@/lib/feeds/rss";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

/* Decide which mode the feed should serve. We can't look at the raw
   `?` because cache-busters (?_=123, ?utm_source=...) shouldn't flip
   the feed into the 200-event filtered mode and re-flood the reader.
   Instead inspect parsed filters for any meaningful constraint. */
function hasMeaningfulFilter(f: FilterState): boolean {
  return (
    f.q.length > 0 ||
    f.regions.length > 0 ||
    f.cities.length > 0 ||
    f.tags.length > 0 ||
    f.sources.length > 0 ||
    f.groups.length > 0 ||
    f.types.length > 0 ||
    Boolean(f.from) ||
    Boolean(f.to) ||
    f.showOnline
  );
}

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  /* Two modes:
     - Bare /api/rss = "what's new" feed: 50 newest ingested upcoming
       in-person events, sorted by created_at desc. Matches RSS reader
       expectations (pubDate = when item appeared).
     - /api/rss?<filters> = filtered view, capped at 200 so a broad
       filter still doesn't dump the entire catalog. */
  const events = hasMeaningfulFilter(filters)
    ? await queryEvents(filters, 200)
    : await getRecentlyAddedEvents(50);
  /* Pin the canonical host - never trust the Host header for outbound
     link generation (an attacker could request the feed with a spoofed
     Host to make CDN-cached link tags point at an attacker domain). */
  const rss = eventsToRss(events, SITE_URL);

  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
