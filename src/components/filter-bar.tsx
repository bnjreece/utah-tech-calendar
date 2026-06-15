"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { UTAH_REGIONS, type UtahRegion } from "@/lib/regions";
import {
  parseFilters,
  filtersToSearchParams,
  sourceLabel,
  TYPE_LABELS,
  type FilterState,
  type EventType,
} from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { MultiSelectPopover } from "@/components/multi-select-popover";
import { ShareFilterButton } from "@/components/share-filter-button";
import { InfoTip } from "@/components/ui/tooltip";
import { StrataLegendTip } from "@/components/tooltips";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/* localStorage key for the last applied filter querystring. Lets us
   offer a one-click "Restore your last view" link when the user lands
   on a bare URL. NOT auto-applied - explicit click means no surprise
   reorientation, no cookie banner required (first-party functional
   storage, GDPR-safe). */
const FILTERS_LSK = "utc:lastFilterQs";

/* URL params owned by the filter state. Anything NOT in this set
   (density, view) is a presentation param we preserve across filter
   changes. Anything IN it must be rebuilt fresh from FilterState on
   every update - copying a stale filter param back from the current
   URL silently undoes a removal (the per-chip X / online-toggle-off
   bug Jesse reported). Keep in sync with filtersToSearchParams. */
const FILTER_PARAM_KEYS = new Set([
  "q",
  "regions",
  "cities",
  "tags",
  "sources",
  "groups",
  "types",
  "from",
  "to",
  "online",
]);

interface CountedOption {
  value: string;
  count: number;
}

interface GroupOption {
  slug: string;
  name: string;
  count: number;
}

interface Props {
  cities: CountedOption[];
  tags: CountedOption[];
  sources: CountedOption[];
  groups: GroupOption[];
}

export function FilterBar({ cities, tags, sources, groups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const filters = parseFilters(searchParams);
  const activeQs = filtersToSearchParams(filters).toString();
  const [savedQs, setSavedQs] = useState<string | null>(null);

  /* Persist the active filter querystring to localStorage so a return
     visit can offer "Restore your last view". Critically, we skip the
     write when activeQs is empty so a visitor opening someone else's
     shared link and clearing it doesn't stomp THEIR prior saved
     state. Explicit dismissal goes through the X button on the
     restore prompt instead, which calls removeItem(). */
  useEffect(() => {
    if (activeQs.length === 0) return;
    try {
      window.localStorage.setItem(FILTERS_LSK, activeQs);
    } catch {
      /* Storage quota or privacy mode - silent. */
    }
  }, [activeQs]);

  /* On mount: read any saved querystring and surface a restore link
     if (a) the URL is currently bare AND (b) the saved string has
     real content. No auto-apply, no popup. */
  useEffect(() => {
    if (activeQs.length > 0) return;
    try {
      const raw = window.localStorage.getItem(FILTERS_LSK);
      if (raw && raw.length > 0) setSavedQs(raw);
    } catch {
      /* same */
    }
  }, [activeQs]);

  function restoreSaved() {
    if (!savedQs) return;
    startTransition(() => {
      router.push(`${pathname}?${savedQs}`);
    });
    setSavedQs(null);
  }

  function update(next: Partial<FilterState>) {
    const merged: FilterState = { ...filters, ...next };
    const sp = filtersToSearchParams(merged);
    /* Preserve non-filter URL params (density, view) so changing a filter
       doesn't bounce the user back to the default weekly/list view. We
       must skip filter params here: re-adding one the user just cleared
       (last chip removed, online toggled off) copies the stale value
       back from the URL and silently undoes the removal. */
    for (const [k, v] of searchParams.entries()) {
      if (!FILTER_PARAM_KEYS.has(k) && !sp.has(k)) sp.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
    });
  }

  function clearOne(key: keyof FilterState, value?: string) {
    if (key === "showOnline") {
      update({ showOnline: false });
      return;
    }
    if (key === "q") {
      update({ q: "" });
      return;
    }
    if (key === "from" || key === "to") {
      update({ [key]: undefined } as Partial<FilterState>);
      return;
    }
    const current = filters[key];
    if (Array.isArray(current) && value !== undefined) {
      update({ [key]: current.filter((v) => v !== value) } as Partial<FilterState>);
    }
  }

  const activeCount =
    (filters.q ? 1 : 0) +
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    filters.groups.length +
    filters.sources.length +
    filters.types.length +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.showOnline ? 1 : 0);

  const typeOptions: { value: EventType; label: string }[] = [
    { value: "conference", label: TYPE_LABELS.conference },
    { value: "paid", label: TYPE_LABELS.paid },
    { value: "free", label: TYPE_LABELS.free },
    { value: "penciled", label: TYPE_LABELS.penciled },
  ];

  const sourceOptions = sources.map((s) => ({
    value: s.value,
    label: sourceLabel(s.value),
    count: s.count,
    dotClass: STRATUM_CLASSES[stratumForEvent(s.value)].bar,
  }));
  const regionOptions = UTAH_REGIONS.map((r) => ({ value: r, label: r }));
  const cityOptions = cities.map((c) => ({
    value: c.value,
    label: c.value === "Unknown" ? "Location TBD" : c.value,
    count: c.count,
  }));
  const cityLabel = (c: string) => (c === "Unknown" ? "Location TBD" : c);
  const regionLabel = (r: string) => (r === "Unknown" ? "Location TBD" : r);
  const tagOptions = tags.map((t) => ({ value: t.value, label: t.value, count: t.count }));
  const groupOptions = groups.map((g) => ({ value: g.slug, label: g.name, count: g.count }));
  const groupNameBySlug = new Map(groups.map((g) => [g.slug, g.name]));
  const groupLabel = (slug: string) => groupNameBySlug.get(slug) ?? slug;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <input
            type="search"
            name="q"
            aria-label="Search events"
            placeholder="Search title, venue, description"
            defaultValue={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            className="w-full rounded-full bg-foreground/[0.04] py-3 sm:py-2.5 pr-4 pl-10 text-base sm:text-sm placeholder:text-foreground/40 focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1 hover:bg-foreground/[0.06] transition-colors"
          />
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40"
          >
            <path
              d="M11 11l3 3M7.5 13a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectPopover
            label="Region"
            options={regionOptions}
            selected={filters.regions}
            onChange={(next) => update({ regions: next as UtahRegion[] })}
          />
          {cities.length > 0 && (
            <MultiSelectPopover
              label="City"
              options={cityOptions}
              selected={filters.cities}
              onChange={(next) => update({ cities: next })}
              searchable
            />
          )}
          {tags.length > 0 && (
            <MultiSelectPopover
              label="Tag"
              options={tagOptions}
              selected={filters.tags}
              onChange={(next) => update({ tags: next })}
              searchable
            />
          )}
          {groups.length > 0 && (
            <MultiSelectPopover
              label="Group"
              options={groupOptions}
              selected={filters.groups}
              onChange={(next) => update({ groups: next })}
              searchable
            />
          )}
          {sources.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MultiSelectPopover
                label="Source"
                options={sourceOptions}
                selected={filters.sources}
                onChange={(next) => update({ sources: next })}
              />
              <StrataLegendTip />
            </span>
          )}
          <MultiSelectPopover
            label="Type"
            options={typeOptions}
            selected={filters.types}
            onChange={(next) => update({ types: next as EventType[] })}
          />
          <DateRangePopover
            from={filters.from}
            to={filters.to}
            onChange={(f, t) => update({ from: f, to: t })}
          />
          <span className="inline-flex items-center gap-1">
            <OnlineToggle
              on={filters.showOnline}
              onChange={(v) => update({ showOnline: v })}
            />
            <InfoTip label="Online events are hidden by default; turn this on to include them." />
          </span>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs uppercase tracking-wide text-foreground/45 mr-1">
            Filters
          </span>
          {filters.q && (
            <ActiveChip label={`"${filters.q}"`} onRemove={() => clearOne("q")} />
          )}
          {filters.regions.map((r) => (
            <ActiveChip key={`r-${r}`} label={regionLabel(r)} onRemove={() => clearOne("regions", r)} />
          ))}
          {filters.cities.map((c) => (
            <ActiveChip key={`c-${c}`} label={cityLabel(c)} onRemove={() => clearOne("cities", c)} />
          ))}
          {filters.tags.map((t) => (
            <ActiveChip key={`t-${t}`} label={t} onRemove={() => clearOne("tags", t)} />
          ))}
          {filters.groups.map((g) => (
            <ActiveChip key={`g-${g}`} label={groupLabel(g)} onRemove={() => clearOne("groups", g)} />
          ))}
          {filters.sources.map((s) => (
            <ActiveChip
              key={`s-${s}`}
              label={sourceLabel(s)}
              onRemove={() => clearOne("sources", s)}
            />
          ))}
          {filters.types.map((t) => (
            <ActiveChip
              key={`type-${t}`}
              label={TYPE_LABELS[t]}
              onRemove={() => clearOne("types", t)}
            />
          ))}
          {filters.from && (
            <ActiveChip label={`from ${filters.from}`} onRemove={() => clearOne("from")} />
          )}
          {filters.to && (
            <ActiveChip label={`to ${filters.to}`} onRemove={() => clearOne("to")} />
          )}
          {filters.showOnline && (
            <ActiveChip label="Including online" onRemove={() => clearOne("showOnline")} />
          )}
          <button
            type="button"
            onClick={() => {
              /* Same idea as update(): nuke filter state but preserve
                 density/view so Clear all doesn't change the view mode. */
              const sp = new URLSearchParams();
              for (const [k, v] of searchParams.entries()) {
                if (!FILTER_PARAM_KEYS.has(k)) sp.set(k, v);
              }
              router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
            }}
            disabled={pending}
            className="ml-1 text-xs text-foreground/55 hover:text-foreground transition-colors"
          >
            Clear all
          </button>
          {/* Share the exact filtered view. Native share sheet on
              mobile, clipboard copy on desktop. Quietly. */}
          <ShareFilterButton label="Share view" />
        </div>
      )}

      {/* Restore-last-view prompt: only when the URL is bare AND there
          is a stored prior filter. Inline link, one click to apply, X
          to dismiss. No modal, no overlay, no cookie banner - this is
          first-party functional storage. */}
      {activeCount === 0 && savedQs && (
        <div className="flex items-center gap-2 pt-1 text-xs text-foreground/55">
          <button
            type="button"
            onClick={restoreSaved}
            className="underline decoration-1 underline-offset-4 hover:text-foreground transition-colors"
          >
            Restore your last view
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.removeItem(FILTERS_LSK);
              } catch {
                /* same */
              }
              setSavedQs(null);
            }}
            aria-label="Dismiss restore prompt"
            className="text-foreground/40 hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunset/15 px-2.5 py-1 text-xs text-sunset-deep">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="-mr-1 inline-flex size-4 items-center justify-center rounded-full hover:bg-sunset/20 transition-colors"
      >
        <svg viewBox="0 0 10 10" aria-hidden className="size-2.5">
          <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

function OnlineToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.04] px-3 py-2 sm:py-1.5 cursor-pointer select-none hover:bg-foreground/[0.08] transition-colors">
      <span className="relative inline-flex w-8 shrink-0 rounded-full p-0.5 inset-ring inset-ring-foreground/10 bg-foreground/10 has-checked:bg-sunset transition-colors duration-200">
        <span className="aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-foreground/5 transition-transform duration-200 ease-in-out [.group:has(input:checked)_&,&:has(+input:checked)]:translate-x-full" />
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          aria-label="Include online events"
          className="absolute inset-0 size-full appearance-none focus:outline-hidden"
        />
      </span>
      <span className="text-base sm:text-sm text-foreground/75">Online</span>
    </label>
  );
}

function DateRangePopover({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  const active = Boolean(from || to);
  const buttonClass = active
    ? "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 sm:py-1.5 text-base sm:text-sm font-medium text-background hover:bg-foreground/85 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
    : "inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-2 sm:py-1.5 text-base sm:text-sm font-medium text-foreground/75 hover:bg-foreground/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep";

  return (
    <Popover>
      <PopoverTrigger className={buttonClass}>
        <span>Date</span>
        <svg viewBox="0 0 10 6" aria-hidden className="size-2.5">
          <path d="M.5.5 5 5l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-foreground/55">
          From
          <input
            type="date"
            value={from ?? ""}
            onChange={(e) => onChange(e.target.value || undefined, to)}
            className="rounded-md bg-foreground/[0.04] px-2.5 py-2 sm:py-1.5 text-base sm:text-sm focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground/55">
          To
          <input
            type="date"
            value={to ?? ""}
            onChange={(e) => onChange(from, e.target.value || undefined)}
            className="rounded-md bg-foreground/[0.04] px-2.5 py-2 sm:py-1.5 text-base sm:text-sm focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1"
          />
        </label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => onChange(undefined, undefined)}
            className="text-xs text-foreground/55 hover:text-foreground self-start"
          >
            Clear dates
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
