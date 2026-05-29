"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { UTAH_REGIONS, type UtahRegion } from "@/lib/regions";
import { parseFilters, filtersToSearchParams, type FilterState } from "@/lib/filters";

interface Props {
  cities: string[];
  tags: string[];
}

export function FilterBar({ cities, tags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const filters = parseFilters(searchParams);

  function update(next: Partial<FilterState>) {
    const merged: FilterState = { ...filters, ...next };
    const sp = filtersToSearchParams(merged);
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  function toggle<T extends string>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  const activeCount =
    (filters.q ? 1 : 0) +
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    (filters.showOnline ? 1 : 0);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-5 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            name="q"
            aria-label="Search events"
            placeholder="Search title, venue, description"
            defaultValue={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            className="w-full rounded-full bg-foreground/[0.04] py-2.5 pr-4 pl-10 text-sm placeholder:text-foreground/40 focus-visible:outline-2 focus-visible:outline-brand -outline-offset-1 transition-colors hover:bg-foreground/[0.06] max-sm:text-base"
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
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            disabled={pending}
            className="shrink-0 text-sm text-foreground/55 hover:text-foreground transition-colors"
          >
            Clear {activeCount}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="group inline-flex items-center gap-2 cursor-pointer select-none">
          <span className="relative inline-flex w-9 shrink-0 rounded-full p-0.5 inset-ring inset-ring-foreground/10 bg-foreground/[0.06] outline-brand outline-offset-2 has-checked:bg-brand has-focus-visible:outline-2 transition-colors duration-200">
            <span className="aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-foreground/5 transition-transform duration-200 ease-in-out [.group:has(input:checked)_&]:translate-x-full" />
            <input
              type="checkbox"
              checked={filters.showOnline}
              onChange={(e) => update({ showOnline: e.target.checked })}
              className="absolute inset-0 size-full appearance-none focus:outline-hidden"
            />
          </span>
          <span className="text-sm text-foreground/75">
            Show online events
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-wide text-foreground/45 mr-1">Region</span>
          {UTAH_REGIONS.map((r) => {
            const on = filters.regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => update({ regions: toggle(filters.regions, r) as UtahRegion[] })}
                className={
                  on
                    ? "inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground hover:bg-brand-deep transition-colors"
                    : "inline-flex items-center rounded-full bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-foreground/75 hover:bg-foreground/[0.08] transition-colors"
                }
              >
                {r}
              </button>
            );
          })}
        </div>

        {cities.length > 0 && (
          <FilterRow
            label="City"
            options={cities}
            selected={filters.cities}
            onToggle={(c) => update({ cities: toggle(filters.cities, c) })}
          />
        )}

        {tags.length > 0 && (
          <FilterRow
            label="Tag"
            options={tags}
            selected={filters.tags}
            onToggle={(t) => update({ tags: toggle(filters.tags, t) })}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-foreground/10 text-sm">
        <span className="text-xs uppercase tracking-wide text-foreground/45">When</span>
        <DateInput
          label="From"
          name="from"
          value={filters.from ?? ""}
          onChange={(v) => update({ from: v || undefined })}
        />
        <DateInput
          label="To"
          name="to"
          value={filters.to ?? ""}
          onChange={(v) => update({ to: v || undefined })}
        />
      </div>
    </div>
  );
}

function FilterRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs uppercase tracking-wide text-foreground/45 mr-1">{label}</span>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={
              on
                ? "inline-flex items-center rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background hover:bg-foreground/85 transition-colors"
                : "inline-flex items-center rounded-full bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-foreground/75 hover:bg-foreground/[0.08] transition-colors"
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function DateInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-foreground/70">
      <span>{label}</span>
      <input
        type="date"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-foreground/[0.04] px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-brand -outline-offset-1 hover:bg-foreground/[0.06] transition-colors max-sm:text-base"
      />
    </label>
  );
}
