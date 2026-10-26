import type { Metadata } from "next";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import {
  queryEvents,
  getSourceCounts,
  getCityCounts,
  getTagCounts,
  getGroupCounts,
} from "@/lib/queries";
import { FilterBar } from "@/components/filter-bar";
import { ViewTabs } from "@/components/view-tabs";
import { EditorialLinearBlock } from "@/components/variant-blocks";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { SpecialWeekBanner } from "@/components/special-week-banner";
import { activeSpecialWeeks, SPECIAL_WEEKS } from "@/lib/special-weeks";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { FEED_ALTERNATE_TYPES, HOME_TITLE, NOINDEX_FOLLOW } from "@/lib/seo-rules";

export const dynamic = "force-dynamic";

/* The page itself stays dynamic (the density cookie + filter params), but the
   database work is cached: keyed by the parsed filters, so the default
   no-filter view - which is nearly all bot and first-visit traffic - serves
   from cache instead of waking the database on every request. 15 minutes is
   fresh enough against a 3-hour scrape cadence. */
const getCachedEvents = unstable_cache(
  async (filters: ReturnType<typeof parseFilters>) => queryEvents(filters),
  ["home-events"],
  { revalidate: 900 },
);

/* The four count queries are filter-independent, so they cache under one
   constant key - a crawler hitting unique filter URLs misses only the events
   query, not all five. */
const getCachedCounts = unstable_cache(
  async () =>
    Promise.all([
      getCityCounts(),
      getTagCounts(),
      getSourceCounts(),
      getGroupCounts(),
    ]),
  ["home-counts"],
  { revalidate: 900 },
);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* The plain homepage canonicalizes to "/" (view, density and utm params
   only change presentation). A filtered view (?tags=, ?q=, ?cities=...) is
   a different list, so it is noindex,follow instead: the curated /tag and
   /city pages are the indexable versions of those filters. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filtered = filtersToSearchParams(parseFilters(await searchParams)).toString() !== "";
  return {
    title: { absolute: HOME_TITLE },
    alternates: filtered
      ? { types: FEED_ALTERNATE_TYPES }
      : { canonical: "/", types: FEED_ALTERNATE_TYPES },
    robots: filtered ? NOINDEX_FOLLOW : undefined,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      title: HOME_TITLE,
      description: SITE_DESCRIPTION,
      url: absoluteUrl("/"),
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE,
      description: SITE_DESCRIPTION,
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: "list" | "calendar" = viewParam === "calendar" ? "calendar" : "list";

  /* Density priority: explicit URL param > schedule_density cookie > weekly.
     The cookie lets the preference survive header-nav clicks that wipe the
     URL state (events / subscribe / submit links). DensityToggle writes the
     cookie when the user picks. */
  const densityParam = Array.isArray(params.density) ? params.density[0] : params.density;
  const cookieStore = await cookies();
  const cookieDensity = cookieStore.get("schedule_density")?.value;
  const density: "weekly" | "monthly" =
    densityParam === "monthly"
      ? "monthly"
      : densityParam === "weekly"
        ? "weekly"
        : cookieDensity === "monthly"
          ? "monthly"
          : "weekly";

  const [events, [cityCounts, tagCounts, sourceCounts, groupCounts]] =
    await Promise.all([getCachedEvents(filters), getCachedCounts()]);

  const cities = cityCounts.map((c) => ({ value: c.city, count: c.count }));
  const tags = tagCounts.map((t) => ({ value: t.tag, count: t.count }));
  const sources = sourceCounts.map((s) => ({ value: s.source, count: s.count }));
  const groups = groupCounts.map((g) => ({ slug: g.slug, name: g.name, count: g.count }));

  const feedQuery = filtersToSearchParams(filters).toString();

  /* Special-week banner + chip, decided per request in Denver days (the
     page is dynamic; only the queries are cached). */
  const weeks = activeSpecialWeeks();
  /* The chip also shows outside the window when a shared link has the
     week's filter on, so it can be turned off. */
  const specialWeeks = SPECIAL_WEEKS.filter(
    (w) => weeks.includes(w) || filters.tags.includes(w.slug),
  ).map((w) => ({ slug: w.slug, label: w.label }));

  return (
    <div className="theme-editorial">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <EditorialLinearBlock
        events={events}
        bannerSlot={
          weeks.length > 0
            ? weeks.map((w) => (
                <SpecialWeekBanner key={w.slug} week={w} filtered={filters.tags.includes(w.slug)} />
              ))
            : null
        }
        filterBarSlot={
          <FilterBar
            cities={cities}
            tags={tags}
            sources={sources}
            groups={groups}
            specialWeeks={specialWeeks}
          />
        }
        viewSlot={<ViewTabs current={view} />}
        feedQuery={feedQuery}
        density={density}
      />
    </div>
  );
}
