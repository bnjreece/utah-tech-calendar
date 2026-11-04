import { NextRequest } from "next/server";
import { parseFilters } from "@/lib/filters";
import { countEvents } from "@/lib/queries";

export const runtime = "nodejs";

/* Cheap event count for the feed builder on /subscribe. Same query
   string and the same filter as /api/ical and /api/rss (lib/queries.ts),
   counted in memory from the shared cached dataset, so the count equals
   what the feed delivers and no request wakes the database. */
export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const count = await countEvents(filters);

  /* The UI surfaces "X+ events" when capped so users know the slice
     overflows the feed limit. /api/ical clamps to 500, so we mirror
     that here. */
  const FEED_LIMIT = 500;
  return Response.json(
    { count, capped: count >= FEED_LIMIT },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
