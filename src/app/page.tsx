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

  return (
    <>
      <section className="strata-hero relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px strata-divider opacity-60" />
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-8 sm:pt-12 sm:pb-10 relative">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft font-medium">
            In-person · Utah · Tech
          </p>
          <h1 className="mt-2 font-semibold text-3xl sm:text-4xl leading-[1.05] tracking-tight text-balance text-ink max-w-[24ch]">
            Find your next meetup, mixer, or conference.
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-6 pb-2">
        <FilterBar cities={cities} tags={tags} sources={sources} />
      </section>

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
            <ViewTabs current={view} />
          </div>
        </div>
        <EventList events={events} grouped={view === "calendar"} />
      </section>
    </>
  );
}
