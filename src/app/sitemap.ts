import type { MetadataRoute } from "next";
import { and, eq, gte } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

/* Dynamic sitemap. Pulls every approved upcoming event so Google can
   crawl each detail page; also includes the main editorial routes and
   the API feeds. Regenerates on each request via force-dynamic so a
   newly-scraped event lands in the sitemap on the next crawl. */

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const upcoming = await db
    .select({ id: events.id, updatedAt: events.updatedAt })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, now)))
    .limit(2000);

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
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

  for (const e of upcoming) {
    routes.push({
      url: `${SITE_URL}/event/${e.id}`,
      lastModified: e.updatedAt ?? now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return routes;
}
