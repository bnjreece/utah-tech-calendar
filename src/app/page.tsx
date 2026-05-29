import Link from "next/link";
import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import { queryEvents, getDistinctCities, getDistinctTags } from "@/lib/queries";
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

  const [events, cities, tags] = await Promise.all([
    queryEvents(filters),
    getDistinctCities(),
    getDistinctTags(),
  ]);

  const feedQuery = filtersToSearchParams(filters).toString();

  return (
    <>
      <section className="border-b border-foreground/5 bg-linear-to-b from-brand-soft/40 to-background">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <p className="text-sm uppercase tracking-wide text-brand-deep font-medium">
            In-person Utah tech
          </p>
          <h1 className="mt-3 font-display text-5xl sm:text-7xl leading-[1.05] text-balance tracking-tight">
            Find your next{" "}
            <span className="italic text-brand">meetup, mixer, or conference</span>
            .
          </h1>
          <p className="mt-4 max-w-[62ch] text-pretty text-base sm:text-lg text-foreground/65">
            One curated calendar of every Utah tech event worth showing up to. Filter by your part of the state, your stack, or your favorite groups. Online events hidden by default.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="w-full lg:w-[320px] lg:shrink-0 lg:sticky lg:top-24 lg:self-start">
            <FilterBar cities={cities} tags={tags} />
            <div className="mt-3 flex items-center gap-3 text-sm text-foreground/55">
              <Link
                href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`}
                className="hover:text-foreground transition-colors"
              >
                iCal
              </Link>
              <span aria-hidden>·</span>
              <Link
                href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`}
                className="hover:text-foreground transition-colors"
              >
                RSS
              </Link>
              <span aria-hidden>·</span>
              <Link href="/submit" className="hover:text-foreground transition-colors">
                Submit an event
              </Link>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="font-display text-3xl tracking-tight">
                {events.length} {events.length === 1 ? "event" : "events"} ahead
              </h2>
              <ViewTabs current={view} />
            </div>
            <EventList events={events} grouped={view === "calendar"} />
          </section>
        </div>
      </section>
    </>
  );
}
