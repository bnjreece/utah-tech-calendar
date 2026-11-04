import type { MetadataRoute } from "next";
import { getPublicData } from "@/lib/public-data";
import { sitemapInputs } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { eventSlug, toSlug } from "@/lib/slugs";
import { countTagHubs, hubIsIndexable, isPlaceholderTitle, periodSlugFor, tagHubPaths } from "@/lib/seo-rules";

/* Dynamic sitemap: the pages worth indexing, and nothing robots.txt blocks.
   - Approved upcoming events with a real title (placeholder and hidden
     events are noindex on their own pages).
   - City, tag and month hubs only when they list at least
     MIN_INDEXABLE_EVENTS events, counted the way each page counts; the
     pages below the bar are noindex, so the two always agree.
   - lastModified only where it's real (an event's updated_at). Hub and
     static pages omit it rather than claim "changed just now".
   Rows come from the shared cached dataset (lib/public-data.ts), counted
   in memory the way each page counts, so a render is no database query.
   Stays force-dynamic; the hourly caching lives in vercel.json's
   Vercel-CDN-Cache-Control header for /sitemap.xml, so crawler requests
   hit the CDN. */

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const { upcoming, cityRows, tagRows, monthRows, groupRows } = sitemapInputs(
    await getPublicData(),
    now,
  );

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

  for (const c of cityRows) {
    if (!hubIsIndexable(c.n)) continue;
    add({ url: `${SITE_URL}/city/${toSlug(c.city)}`, changeFrequency: "daily", priority: 0.7 });
  }

  /* founders lists at /startup-events, the rest at /tag/<slug>. */
  for (const path of tagHubPaths(countTagHubs(tagRows))) {
    add({ url: `${SITE_URL}${path}`, changeFrequency: "daily", priority: 0.7 });
  }

  const thisMonth = periodSlugFor(now);
  for (const r of monthRows) {
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
