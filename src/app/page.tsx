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
  const next5 = events.slice(0, 5);

  return (
    <>
      <div data-uidotsh-pick="Top section" className="contents">
        {/* Option 1: Strata hero (current) */}
        <div data-uidotsh-option="Strata hero (current)" className="contents">
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
        </div>

        {/* Option 2: Stat strip — no hero block, just a thin gradient + one-line stat */}
        <div data-uidotsh-option="Stat strip" className="contents" hidden>
          <div aria-hidden className="h-1.5 strata-divider" />
          <section className="mx-auto max-w-6xl px-6 pt-6 pb-2">
            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <span className="font-semibold text-2xl tracking-tight tabular-nums">
                {events.length}
              </span>
              <span className="text-2xl font-semibold tracking-tight">
                in-person Utah tech events
              </span>
              <span className="text-sm text-ink-soft">
                · upcoming · online hidden by default
              </span>
            </div>
          </section>
        </div>

        {/* Option 3: Filters-first — go straight to filter bar, no hero at all */}
        <div data-uidotsh-option="Filters-first" className="contents" hidden>
          <div aria-hidden className="h-px strata-divider opacity-70" />
        </div>

        {/* Option 4: Live marquee — kinetic ticker of next 5 events */}
        <div data-uidotsh-option="Live marquee" className="contents" hidden>
          <div className="relative overflow-hidden bg-paper-deep border-y border-ink/5">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px strata-divider opacity-60" />
            <div className="py-3.5 overflow-hidden">
              <div className="flex items-center gap-10 whitespace-nowrap animate-[marquee_60s_linear_infinite]">
                {[...next5, ...next5, ...next5].map((e, i) => {
                  const d = new Date(e.startsAt);
                  return (
                    <Link
                      key={`${e.id}-${i}`}
                      href={`/event/${e.id}`}
                      className="flex items-center gap-3 text-sm hover:text-sunset-deep transition-colors"
                    >
                      <span aria-hidden className="block size-1.5 rounded-full bg-sunset" />
                      <span className="font-medium text-ink-soft tabular-nums uppercase tracking-wide text-xs">
                        {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span className="font-semibold text-ink">{e.title}</span>
                      {e.venueName && (
                        <span className="text-ink-soft">· {e.venueName}</span>
                      )}
                      {e.city && (
                        <span className="text-ink-soft">· {e.city}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            <style>{`
              @keyframes marquee {
                from { transform: translateX(0); }
                to { transform: translateX(-33.333%); }
              }
            `}</style>
          </div>
        </div>
      </div>

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
