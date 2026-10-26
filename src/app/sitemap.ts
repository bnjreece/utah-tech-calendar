import type { MetadataRoute } from "next";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { eventSlug, toSlug } from "@/lib/slugs";
import { countTagHubs, hubIsIndexable, indexableHubs, isPlaceholderTitle, periodSlugFor } from "@/lib/seo-rules";

/* Dynamic sitemap: the pages worth indexing, and nothing robots.txt blocks.
   - Approved upcoming events with a real title (placeholder and hidden
     events are noindex on their own pages).
   - City, tag and month hubs only when they list at least
     MIN_INDEXABLE_EVENTS events, counted the way each page counts; the
     pages below the bar are noindex, so the two always agree.
   - lastModified only where it's real (an event's updated_at). Hub and
     static pages omit it rather than claim "changed just now".
   Stays force-dynamic (ISR would demand a database connection at build
   time); the hourly caching lives in vercel.json's Vercel-CDN-Cache-Control
   header for /sitemap.xml, so crawler requests hit the CDN. */

export const dynamic = "force-dynamic";

type Rows<T> = T[] | { rows?: T[] };
const rowsOf = <T,>(r: Rows<T>): T[] => (Array.isArray(r) ? r : r.rows ?? []);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [upcoming, cityRows, tagRows, monthRows, groupRows] = await Promise.all([
    db
      .select({ id: events.id, title: events.title, updatedAt: events.updatedAt })
      .from(events)
      .where(and(eq(events.status, "approved"), gte(events.startsAt, now)))
      .limit(2000),
    /* /city/<slug>: approved, in person, upcoming, exact city. */
    db.execute<{ city: string; n: number }>(sql`
      SELECT city, count(*)::int AS n
      FROM events
      WHERE city IS NOT NULL AND trim(city) <> ''
        AND status = 'approved' AND is_online = false AND starts_at >= now()
      GROUP BY city
    `),
    /* /tag/<tag>: approved, in person, upcoming; counted in JS so old
       spellings and special-week titles fold in like the page does. */
    db
      .select({ tags: events.tags, title: events.title, startsAt: events.startsAt })
      .from(events)
      .where(and(eq(events.status, "approved"), eq(events.isOnline, false), gte(events.startsAt, now)))
      .limit(5000),
    /* /events/<month>: approved events in the UTC month (lib/period.ts),
       the last 12 months through the next 12. */
    db.execute<{ y: number; m: number; n: number }>(sql`
      SELECT extract(year FROM starts_at AT TIME ZONE 'UTC')::int AS y,
             extract(month FROM starts_at AT TIME ZONE 'UTC')::int AS m,
             count(*)::int AS n
      FROM events
      WHERE status = 'approved'
        AND starts_at >= ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))}
        AND starts_at < ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1))}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `),
    db.select({ slug: groups.slug }).from(groups).where(eq(groups.status, "active")),
  ]);

  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/discover`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/subscribe`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/submit`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/archive`, changeFrequency: "weekly", priority: 0.5 },
  ];
  const seen = new Set(routes.map((r) => r.url));
  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    routes.push(entry);
  };

  for (const c of rowsOf(cityRows)) {
    if (!hubIsIndexable(c.n)) continue;
    add({ url: `${SITE_URL}/city/${toSlug(c.city)}`, changeFrequency: "daily", priority: 0.7 });
  }

  for (const tag of indexableHubs(countTagHubs(tagRows))) {
    add({ url: `${SITE_URL}/tag/${toSlug(tag)}`, changeFrequency: "daily", priority: 0.7 });
  }

  const thisMonth = periodSlugFor(now);
  for (const r of rowsOf(monthRows)) {
    if (!hubIsIndexable(r.n)) continue;
    const start = new Date(Date.UTC(r.y, r.m - 1, 1));
    const upcomingMonth = start.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    add({
      url: `${SITE_URL}/events/${periodSlugFor(start)}`,
      changeFrequency: upcomingMonth ? "weekly" : "monthly",
      priority: periodSlugFor(start) === thisMonth ? 0.7 : upcomingMonth ? 0.6 : 0.4,
    });
  }

  for (const g of groupRows) {
    add({ url: `${SITE_URL}/group/${g.slug}`, changeFrequency: "daily", priority: 0.6 });
  }

  for (const e of upcoming) {
    if (isPlaceholderTitle(e.title)) continue;
    add({
      url: `${SITE_URL}/event/${eventSlug(e.title, e.id)}`,
      lastModified: e.updatedAt ?? undefined,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return routes;
}
