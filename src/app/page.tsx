import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import { queryEvents, getDistinctCities, getDistinctTags } from "@/lib/queries";
import { EventList } from "@/components/event-list";
import { FilterBar } from "@/components/filter-bar";
import { ViewTabs } from "@/components/view-tabs";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upcoming Utah tech events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {events.length} {events.length === 1 ? "event" : "events"} matching your filters
          </p>
        </div>
        <ViewTabs current={view} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <FilterBar cities={cities} tags={tags} />
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link
              href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Subscribe (iCal)
            </Link>
            <Link
              href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              RSS feed
            </Link>
            <Link
              href="/submit"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Submit an event
            </Link>
          </div>
        </aside>

        <section>
          <EventList events={events} grouped={view === "calendar"} />
        </section>
      </div>
    </div>
  );
}
