import { NextRequest } from "next/server";
import { parseFilters } from "@/lib/filters";
import { queryEvents } from "@/lib/queries";

export const runtime = "nodejs";

/* Cheap event count for the feed builder on /subscribe. Same query
   string as /api/ical, /api/rss; returns just the count so the UI can
   show "X events match" without parsing a 500-event VCALENDAR. */
export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const events = await queryEvents(filters, 500);
  return Response.json(
    { count: events.length, capped: events.length >= 500 },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
