import { and, eq, gte, lte, ilike, or, inArray, sql, desc, asc } from "drizzle-orm";
import { db, events, groups, type Event, type Group } from "./db";
import { categorizeRegion, type UtahRegion } from "./regions";
import type { FilterState } from "./filters";

export interface EventWithGroup extends Event {
  group: Group | null;
  region: UtahRegion;
}

export async function queryEvents(filters: FilterState, limit = 200): Promise<EventWithGroup[]> {
  const conditions = [eq(events.status, "approved")];

  const fromDate = filters.from ? new Date(filters.from) : new Date();
  conditions.push(gte(events.startsAt, fromDate));

  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(events.startsAt, toDate));
  }

  if (!filters.showOnline) {
    conditions.push(eq(events.isOnline, false));
  }

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

  if (filters.cities.length) {
    /* The literal "Unknown" sentinel in the filter is the parallel of
       the Unknown UtahRegion - it selects rows where city is NULL.
       Other values are matched directly. We split the filter into the
       known/unknown halves and OR them so a picker like
       ["Lehi", "Unknown"] returns both. */
    const known = filters.cities.filter((c) => c !== "Unknown");
    const wantsUnknown = filters.cities.includes("Unknown");
    const cityConds = [];
    if (known.length) cityConds.push(inArray(events.city, known));
    if (wantsUnknown) cityConds.push(sql`${events.city} IS NULL`);
    if (cityConds.length) conditions.push(or(...cityConds)!);
  }

  if (filters.groups.length) {
    conditions.push(inArray(events.groupId, filters.groups));
  }

  if (filters.tags.length) {
    /* Build an explicit ARRAY[…]::text[] literal because the neon-http
       driver serializes a JS array as a single text parameter, which
       Postgres can't parse as `text[]` for the `&&` overlap operator. */
    conditions.push(
      sql`${events.tags} && ARRAY[${sql.join(
        filters.tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    );
  }

  if (filters.sources.length) {
    conditions.push(inArray(events.source, filters.sources));
  }

  /* Type filter: OR within the chip (e.g. Conference OR Free), AND
     with everything else. Free is the inverse of Paid (is_paid=false)
     and includes all unflagged events, so picking it alone yields
     "everything that isn't a paid ticketed event." */
  if (filters.types.length) {
    const typeConds = filters.types.map((t) => {
      if (t === "conference") return eq(events.isConference, true);
      if (t === "paid") return eq(events.isPaid, true);
      if (t === "free") return eq(events.isPaid, false);
      return eq(events.isTentative, true);
    });
    conditions.push(or(...typeConds)!);
  }

  const rows = await db
    .select({
      event: events,
      group: groups,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .limit(limit);

  const enriched: EventWithGroup[] = rows.map((r) => ({
    ...r.event,
    group: r.group,
    region: categorizeRegion({
      city: r.event.city,
      venueName: r.event.venueName,
      address: r.event.address,
    }),
  }));

  if (filters.regions.length) {
    return enriched.filter((e) => filters.regions.includes(e.region));
  }

  return enriched;
}

export async function getRecentlyAddedEvents(limit = 50): Promise<EventWithGroup[]> {
  /* RSS "what's new" feed: newest rows we've ingested, narrowed to
     upcoming + in-person + approved. Sorted by created_at desc so a
     reader's "5 new today" grouping matches reality (vs ordering by
     startsAt, which makes every event appear as "published on its
     event date" and floods the today bucket). */
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        gte(events.startsAt, new Date()),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r.event,
    group: r.group,
    region: categorizeRegion({
      city: r.event.city,
      venueName: r.event.venueName,
      address: r.event.address,
    }),
  }));
}

export async function getEventById(id: string): Promise<EventWithGroup | null> {
  const [row] = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.event,
    group: row.group,
    region: categorizeRegion({
      city: row.event.city,
      venueName: row.event.venueName,
      address: row.event.address,
    }),
  };
}

export async function getGroupBySlug(slug: string): Promise<Group | null> {
  const [row] = await db.select().from(groups).where(eq(groups.slug, slug)).limit(1);
  return row ?? null;
}

export async function getUpcomingEventsForGroup(groupId: string): Promise<EventWithGroup[]> {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.groupId, groupId),
        eq(events.status, "approved"),
        gte(events.startsAt, new Date()),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(50);
  return rows.map((r) => ({
    ...r.event,
    group: r.group,
    region: categorizeRegion({
      city: r.event.city,
      venueName: r.event.venueName,
      address: r.event.address,
    }),
  }));
}

export async function getDistinctCities(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: events.city })
    .from(events)
    .where(and(eq(events.status, "approved"), eq(events.isOnline, false)));
  return rows.map((r) => r.city).filter((c): c is string => Boolean(c)).sort();
}

export async function getDistinctTags(): Promise<string[]> {
  const rows = await db
    .select({ tags: events.tags })
    .from(events)
    .where(eq(events.status, "approved"));
  const set = new Set<string>();
  for (const r of rows) {
    for (const t of r.tags ?? []) set.add(t);
  }
  return Array.from(set).sort();
}

export async function getAllGroups(): Promise<Group[]> {
  return db.select().from(groups).where(eq(groups.status, "active")).orderBy(asc(groups.name));
}

export async function getDistinctSources(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ source: events.source })
    .from(events)
    .where(eq(events.status, "approved"));
  return rows.map((r) => r.source).filter(Boolean).sort();
}

export async function getSourceCounts(): Promise<Array<{ source: string; count: number }>> {
  const rows = await db
    .select({ source: events.source, count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, new Date())))
    .groupBy(events.source);
  return rows
    .filter((r) => r.source)
    .sort((a, b) => b.count - a.count);
}

export async function getCityCounts(): Promise<Array<{ city: string; count: number }>> {
  const rows = await db
    .select({ city: events.city, count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        gte(events.startsAt, new Date()),
      ),
    )
    .groupBy(events.city);
  /* Surface NULL-city events as a synthetic "Unknown" entry so the
     city picker can include them - parallel with the Unknown
     UtahRegion exposed as "Location TBD" in the FeedBuilder. */
  const unknownRow = rows.find((r) => !r.city);
  const namedRows = rows.filter((r): r is { city: string; count: number } => Boolean(r.city));
  const result = namedRows.slice();
  if (unknownRow && unknownRow.count > 0) {
    result.push({ city: "Unknown", count: unknownRow.count });
  }
  return result
    .sort((a, b) => b.count - a.count);
}

export async function getTagCounts(): Promise<Array<{ tag: string; count: number }>> {
  const rows = await db
    .select({ tags: events.tags })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, new Date())));
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
