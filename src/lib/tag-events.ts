import { cache } from "react";
import { and, asc, eq, gte, or, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { specialWeekMatchSql, type EventWithGroup } from "@/lib/queries";
import { categorizeRegion } from "@/lib/regions";
import { tagQueryVariants } from "@/lib/auto-tag";

/* The upcoming in-person events a tag landing page lists (/tag/<tag> and
   /startup-events). Old spellings and special-week titles fold in, the
   same way the sitemap counts them (lib/seo-rules.ts countTagHubs).
   cache(): generateMetadata and the page share one query per request. */
export const fetchTagEvents = cache(async (tag: string): Promise<EventWithGroup[]> => {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        gte(events.startsAt, new Date()),
        or(
          /* Old spellings too, for rows not yet rewritten. */
          sql`EXISTS (SELECT 1 FROM unnest(${events.tags}) AS t WHERE lower(t) IN (${sql.join(
            tagQueryVariants(tag.toLowerCase()).map((v) => sql`${v}`),
            sql`, `,
          )}))`,
          specialWeekMatchSql(tag) ?? sql`false`,
        ),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(200);

  return rows.map((r) => ({
    ...r.event,
    group: r.group,
    region: categorizeRegion({
      city: r.event.city,
      venueName: r.event.venueName,
      address: r.event.address,
    }),
  }));
});
