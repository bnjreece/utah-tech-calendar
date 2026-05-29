import Link from "next/link";
import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import {
  queryEvents,
  getSourceCounts,
  getCityCounts,
  getTagCounts,
} from "@/lib/queries";
import { EventList } from "@/components/event-list";
import { FilterBar } from "@/components/filter-bar";
import { ViewTabs } from "@/components/view-tabs";
import {
  WasatchBlock,
  ApartmentBlock,
  MainframeBlock,
  GlacierBlock,
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

  const currentInner = (
    <>
      <div aria-hidden className="h-px strata-divider opacity-70" />
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="font-semibold text-2xl tracking-tight">
            {events.length} {events.length === 1 ? "event" : "events"} ahead
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`}
              className="text-ink-soft hover:text-ink transition-colors"
            >
              iCal
            </Link>
            <Link
              href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`}
              className="text-ink-soft hover:text-ink transition-colors"
            >
              RSS
            </Link>
            {viewSlot}
          </div>
        </div>
        <EventList events={events} grouped={view === "calendar"} />
      </section>
    </>
  );

  return (
    <div data-uidotsh-pick="Visual identity" className="contents">
      <div data-uidotsh-option="Sunset Strata (current)" className="contents">
        {currentInner}
      </div>

      <div
        data-uidotsh-option="Wasatch — field guide"
        className="contents theme-wasatch"
        hidden
      >
        <WasatchBlock events={events} filterBarSlot={filterBarSlot} viewSlot={viewSlot} feedQuery={feedQuery} />
      </div>

      <div
        data-uidotsh-option="Apartment — magazine"
        className="contents theme-apartment"
        hidden
      >
        <ApartmentBlock events={events} filterBarSlot={filterBarSlot} viewSlot={viewSlot} feedQuery={feedQuery} />
      </div>

      <div
        data-uidotsh-option="Mainframe — terminal"
        className="contents theme-mainframe"
        hidden
      >
        <MainframeBlock events={events} filterBarSlot={filterBarSlot} viewSlot={viewSlot} feedQuery={feedQuery} />
      </div>

      <div
        data-uidotsh-option="Glacier — Linear/Vercel"
        className="contents theme-glacier"
        hidden
      >
        <GlacierBlock events={events} filterBarSlot={filterBarSlot} viewSlot={viewSlot} feedQuery={feedQuery} />
      </div>
    </div>
  );
}
