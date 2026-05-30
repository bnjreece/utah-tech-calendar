import { NextRequest } from "next/server";
import { and, eq, gte, lte, ilike, or, inArray, sql } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { categorizeRegion } from "@/lib/regions";

export const runtime = "nodejs";

/* Cheap event count for the feed builder on /subscribe. Same query
   string as /api/ical, /api/rss; returns just { count } so the UI can
   show "X events match" without parsing a 500-event VCALENDAR. We do
   a real SELECT count(*) for the SQL-side filters, then narrow with
   the in-memory region filter when the user picked any regions (since
   region is derived from city, not stored). */
export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const fromDate = filters.from ? new Date(filters.from) : new Date();

  const conditions = [
    eq(events.status, "approved"),
    gte(events.startsAt, fromDate),
  ];
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(events.startsAt, toDate));
  }
  if (!filters.showOnline) conditions.push(eq(events.isOnline, false));
  if (filters.q) {
    const q = `%${filters.q}%`;
    const term = or(
      ilike(events.title, q),
      ilike(events.description, q),
      ilike(events.venueName, q),
      ilike(events.address, q),
    );
    if (term) conditions.push(term);
  }
  if (filters.cities.length) conditions.push(inArray(events.city, filters.cities));
  if (filters.groups.length) conditions.push(inArray(events.groupId, filters.groups));
  if (filters.tags.length) {
    conditions.push(
      sql`${events.tags} && ARRAY[${sql.join(
        filters.tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    );
  }
  if (filters.sources.length) conditions.push(inArray(events.source, filters.sources));
  if (filters.types.length) {
    const typeConds = filters.types.map((t) => {
      if (t === "conference") return eq(events.isConference, true);
      if (t === "paid") return eq(events.isPaid, true);
      if (t === "free") return eq(events.isPaid, false);
      return eq(events.isTentative, true);
    });
    conditions.push(or(...typeConds)!);
  }

  let count: number;
  if (filters.regions.length) {
    /* Region is computed from city/venue/address - has to be done after
       fetching. We pull the minimum columns needed for categorizeRegion
       rather than full event rows + joins, and cap at 5000 to keep this
       endpoint cheap even when the corpus grows. The cap matches the
       FEED_LIMIT semantics below: a slice that overflows it just shows
       "5000+" to the user, which is more than enough signal. */
    const REGION_BRANCH_CAP = 5000;
    const rows = await db
      .select({
        city: events.city,
        venueName: events.venueName,
        address: events.address,
      })
      .from(events)
      .where(and(...conditions))
      .limit(REGION_BRANCH_CAP);
    count = rows.filter((r) =>
      filters.regions.includes(
        categorizeRegion({ city: r.city, venueName: r.venueName, address: r.address }),
      ),
    ).length;
  } else {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(events)
      .where(and(...conditions));
    count = row?.c ?? 0;
  }

  /* The UI surfaces "X+ events" when capped so users know the slice
     overflows the feed limit. /api/ical clamps to 500, so we mirror
     that here. */
  const FEED_LIMIT = 500;
  return Response.json(
    { count, capped: count >= FEED_LIMIT },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
