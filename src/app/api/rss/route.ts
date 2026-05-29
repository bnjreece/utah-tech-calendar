import { NextRequest } from "next/server";
import { parseFilters } from "@/lib/filters";
import { queryEvents } from "@/lib/queries";
import { eventsToRss } from "@/lib/feeds/rss";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const events = await queryEvents(filters, 500);
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "utahtechevents.com";
  const baseUrl = `${proto}://${host}`;
  const rss = eventsToRss(events, baseUrl);

  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
