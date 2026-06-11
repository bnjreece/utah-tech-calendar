import { NextRequest } from "next/server";
import { parseFilters } from "@/lib/filters";
import { queryEvents } from "@/lib/queries";
import { eventsToIcal } from "@/lib/feeds/ical";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const events = await queryEvents(filters, 500);
  const host = request.headers.get("host") ?? "utahtechevents.com";
  const ical = eventsToIcal(events, host);

  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="utah-tech-calendar.ics"',
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
