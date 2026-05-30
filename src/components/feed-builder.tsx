"use client";

import { useEffect, useMemo, useState } from "react";
import { UTAH_REGIONS, type UtahRegion } from "@/lib/regions";
import {
  filtersToSearchParams,
  SOURCE_LABELS,
  TYPE_LABELS,
  type FilterState,
  type EventType,
} from "@/lib/filters";
import { MultiSelectPopover } from "@/components/multi-select-popover";
import { SubscribePopover } from "@/components/subscribe-popover";

interface CountedOption {
  value: string;
  count: number;
}

interface Props {
  cities: CountedOption[];
  tags: CountedOption[];
  sources: CountedOption[];
}

const EMPTY: FilterState = {
  q: "",
  regions: [],
  cities: [],
  tags: [],
  sources: [],
  groups: [],
  types: [],
  showOnline: false,
};

const TYPES: EventType[] = ["conference", "paid", "free", "penciled"];

/* Build a subscription URL by composing the same filters the schedule
   page uses. State is local - no router push - so the user can iterate
   without bouncing the schedule view. The resulting query string feeds
   the SubscribePopover, which already knows how to deeplink to Apple
   Calendar (webcal://), Google Calendar (?cid=), and how to expose
   raw iCal/RSS URLs. */
export function FeedBuilder({ cities, tags, sources }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  const [count, setCount] = useState<number | null>(null);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);

  const feedQuery = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);

  /* Debounced live count via the /api/feed/count endpoint. 250ms is
     enough to avoid hammering on rapid chip clicks while still feeling
     responsive. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/feed/count${feedQuery ? `?${feedQuery}` : ""}`);
        const json = (await res.json()) as { count: number; capped: boolean };
        if (cancelled) return;
        setCount(json.count);
        setCapped(json.capped);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [feedQuery]);

  const activeCount =
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    filters.sources.length +
    filters.types.length +
    (filters.showOnline ? 1 : 0);

  function toggleRegion(r: UtahRegion) {
    setFilters((f) =>
      f.regions.includes(r)
        ? { ...f, regions: f.regions.filter((x) => x !== r) }
        : { ...f, regions: [...f.regions, r] },
    );
  }

  function toggleType(t: EventType) {
    setFilters((f) =>
      f.types.includes(t)
        ? { ...f, types: f.types.filter((x) => x !== t) }
        : { ...f, types: [...f.types, t] },
    );
  }

  const cityOptions = cities.map((c) => ({ value: c.value, label: c.value, count: c.count }));
  const tagOptions = tags.map((t) => ({ value: t.value, label: t.value, count: t.count }));
  const sourceOptions = sources.map((s) => ({
    value: s.value,
    label: SOURCE_LABELS[s.value] ?? s.value,
    count: s.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Region chips - fixed list of 5, no dropdown needed */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">
          Regions
        </p>
        <div className="flex flex-wrap gap-2">
          {UTAH_REGIONS.filter((r) => r !== "Unknown").map((r) => {
            const on = filters.regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRegion(r)}
                aria-pressed={on}
                className={
                  on
                    ? "rounded-full bg-ink text-paper px-3 py-1.5 text-sm font-medium"
                    : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dropdowns for the dynamic dimensions */}
      <div className="flex flex-wrap gap-3">
        <MultiSelectPopover
          label="Cities"
          options={cityOptions}
          selected={filters.cities}
          onChange={(v) => setFilters((f) => ({ ...f, cities: v }))}
          searchable
        />
        <MultiSelectPopover
          label="Tags"
          options={tagOptions}
          selected={filters.tags}
          onChange={(v) => setFilters((f) => ({ ...f, tags: v }))}
          searchable
        />
        <MultiSelectPopover
          label="Sources"
          options={sourceOptions}
          selected={filters.sources}
          onChange={(v) => setFilters((f) => ({ ...f, sources: v }))}
        />
      </div>

      {/* Type chips + online toggle */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                aria-pressed={on}
                className={
                  on
                    ? "rounded-full bg-ink text-paper px-3 py-1.5 text-sm font-medium"
                    : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
                }
              >
                {TYPE_LABELS[t]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, showOnline: !f.showOnline }))}
            aria-pressed={filters.showOnline}
            className={
              filters.showOnline
                ? "rounded-full bg-dusk-deep text-paper px-3 py-1.5 text-sm font-medium"
                : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
            }
          >
            {filters.showOnline ? "Online: included" : "Online: hidden"}
          </button>
        </div>
      </div>

      {/* Live count + clear + subscribe */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-ink/15">
        <div>
          <p className="font-display text-2xl italic tracking-tight">
            {count === null ? (
              <span className="text-ink-soft">…</span>
            ) : (
              <>
                {count}
                {capped && "+"} event{count === 1 ? "" : "s"} match
              </>
            )}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mt-1">
            {loading ? "Updating…" : activeCount === 0 ? "No filters - everything" : `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink underline decoration-1 underline-offset-4"
            >
              Reset
            </button>
          )}
          <SubscribePopover
            feedQuery={feedQuery}
            triggerLabel="Subscribe to this view"
            variant="card"
          />
        </div>
      </div>
    </div>
  );
}
