import type { MetadataRoute } from "next";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { eventSlug, toSlug } from "@/lib/slugs";
import { listUpcomingPeriodSlugs } from "@/lib/period";
import { getAllCanonicalTags } from "@/lib/tag-taxonomy";

/* Dynamic sitemap. Pulls every approved upcoming event so Google can
   crawl each detail page (using the canonical slug URL); also includes
   the main editorial routes and city landing pages. Regenerates on each
   request via force-dynamic so a newly-scraped event lands in the
   sitemap on the next crawl. */

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const upcoming = await db
    .select({
      id: events.id,
      title: events.title,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, now)))
    .limit(2000);

  const cityRows = await db.execute<{ city: string }>(sql`
    SELECT DISTINCT city
    FROM events
    WHERE city IS NOT NULL
      AND trim(city) <> ''
      AND status = 'approved'
      AND starts_at >= now()
  `);
  const cities = (Array.isArray(cityRows) ? cityRows : cityRows.rows ?? []) as Array<{ city: string }>;

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/discover`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/subscribe`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/api/ical`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/api/rss`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.3,
    },
  ];

  for (const c of cities) {
    routes.push({
      url: `${SITE_URL}/city/${toSlug(c.city)}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  const groupRows = await db
    .select({ slug: groups.slug })
    .from(groups)
    .where(eq(groups.status, "active"));
  for (const g of groupRows) {
    routes.push({
      url: `${SITE_URL}/group/${g.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  /* Tag landing pages. Two sources combined + deduped:
     - Curated canonical verticals (fintech, healthtech, edtech, etc)
       always appear so Google indexes them even on a dry week. Higher
       priority because these are the SEO targets.
     - Tags that exist on actual upcoming events. Covers the long tail
       (laravel, rust, etc) that aren't curated but earn an indexable
       page by virtue of having content. */
  const tagSlugs = new Set<string>();
  for (const meta of getAllCanonicalTags()) {
    const slug = toSlug(meta.tag);
    tagSlugs.add(slug);
    routes.push({
      url: `${SITE_URL}/tag/${slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: meta.featured ? 0.8 : 0.7,
    });
  }
  const tagRows = await db.execute<{ tag: string }>(sql`
    SELECT DISTINCT lower(tag) AS tag
    FROM events, unnest(tags) AS tag
    WHERE status = 'approved' AND starts_at >= now()
  `);
  const tags = (Array.isArray(tagRows) ? tagRows : tagRows.rows ?? []) as Array<{ tag: string }>;
  for (const t of tags) {
    const slug = toSlug(t.tag);
    if (tagSlugs.has(slug)) continue;
    tagSlugs.add(slug);
    routes.push({
      url: `${SITE_URL}/tag/${slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  /* Date archive pages for the next 12 months + 4 seasons. */
  for (const slug of listUpcomingPeriodSlugs(now)) {
    routes.push({
      url: `${SITE_URL}/events/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const e of upcoming) {
    routes.push({
      url: `${SITE_URL}/event/${eventSlug(e.title, e.id)}`,
      lastModified: e.updatedAt ?? now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return routes;
}
