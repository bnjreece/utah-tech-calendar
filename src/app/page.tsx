import Link from "next/link";
import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import {
  queryEvents,
  getDistinctCities,
  getDistinctTags,
  getDistinctSources,
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

  const [events, cities, tags, sources] = await Promise.all([
    queryEvents(filters),
    getDistinctCities(),
    getDistinctTags(),
    getDistinctSources(),
  ]);

  const feedQuery = filtersToSearchParams(filters).toString();

  return (
    <>
      <section className="strata-hero relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px strata-divider opacity-60" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 relative">
          <p className="text-sm uppercase tracking-[0.18em] text-ink-soft font-medium">
            In-person · Utah · Tech
          </p>
          <h1 className="mt-4 font-semibold text-5xl sm:text-7xl leading-[1.02] tracking-tight text-balance text-ink">
            Find your next meetup, mixer, or conference.
          </h1>
          <p className="mt-5 max-w-[58ch] text-pretty text-base sm:text-lg text-ink-soft">
            One curated calendar of every Utah tech event worth showing up to. Filter by region, city, stack, or source. Online events hidden by default.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper hover:bg-ink/85 transition-colors"
            >
              Submit an event
            </Link>
            <Link
              href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`}
              className="inline-flex items-center gap-2 rounded-full bg-paper/70 ring-1 ring-ink/10 px-5 py-2.5 font-medium text-ink hover:bg-paper transition-colors"
            >
              Subscribe to iCal
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
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
