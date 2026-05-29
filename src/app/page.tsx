import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import {
  queryEvents,
  getSourceCounts,
  getCityCounts,
  getTagCounts,
} from "@/lib/queries";
import { FilterBar } from "@/components/filter-bar";
import { ViewTabs } from "@/components/view-tabs";
import {
  EditorialStripBlock,
  EditorialLinearBlock,
} from "@/components/variant-blocks";

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

  const [events, cityCounts, tagCounts, sourceCounts] = await Promise.all([
    queryEvents(filters),
    getCityCounts(),
    getTagCounts(),
    getSourceCounts(),
  ]);

  const cities = cityCounts.map((c) => ({ value: c.city, count: c.count }));
  const tags = tagCounts.map((t) => ({ value: t.tag, count: t.count }));
  const sources = sourceCounts.map((s) => ({ value: s.source, count: s.count }));

  const feedQuery = filtersToSearchParams(filters).toString();
  const filterBarSlot = <FilterBar cities={cities} tags={tags} sources={sources} />;
  const viewSlot = <ViewTabs current={view} />;

  const props = { events, filterBarSlot, viewSlot, feedQuery };

  return (
    <div data-uidotsh-pick="Editorial system" className="contents">
      <div
        data-uidotsh-option="A. Fraunces + Inter · strip cards (recommended)"
        className="contents theme-editorial"
      >
        <EditorialStripBlock {...props} />
      </div>

      <div
        data-uidotsh-option="B. PT Serif + Switzer · strip cards"
        className="contents theme-editorial type-ptserif"
        hidden
      >
        <EditorialStripBlock {...props} />
      </div>

      <div
        data-uidotsh-option="C. Fraunces + Inter · pure linear list"
        className="contents theme-editorial"
        hidden
      >
        <EditorialLinearBlock {...props} />
      </div>

      <div
        data-uidotsh-option="D. PT Serif + Switzer · pure linear list"
        className="contents theme-editorial type-ptserif"
        hidden
      >
        <EditorialLinearBlock {...props} />
      </div>
    </div>
  );
}
