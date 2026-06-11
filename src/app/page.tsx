import { cookies } from "next/headers";
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

  const [events, cityCounts, tagCounts, sourceCounts, groupCounts] = await Promise.all([
    queryEvents(filters),
    getCityCounts(),
    getTagCounts(),
    getSourceCounts(),
    getGroupCounts(),
  ]);

  const cities = cityCounts.map((c) => ({ value: c.city, count: c.count }));
  const tags = tagCounts.map((t) => ({ value: t.tag, count: t.count }));
  const sources = sourceCounts.map((s) => ({ value: s.source, count: s.count }));
  const groups = groupCounts.map((g) => ({ slug: g.slug, name: g.name, count: g.count }));

  const feedQuery = filtersToSearchParams(filters).toString();

  return (
    <div className="theme-editorial">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <EditorialLinearBlock
        events={events}
        filterBarSlot={<FilterBar cities={cities} tags={tags} sources={sources} groups={groups} />}
        viewSlot={<ViewTabs current={view} />}
        feedQuery={feedQuery}
        density={density}
      />
    </div>
  );
}
