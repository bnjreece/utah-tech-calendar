"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  function toggleArrayItem<T extends string>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  const activeCount =
    (filters.q ? 1 : 0) +
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    filters.groups.length +
    (filters.showOnline ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search title, venue, description..."
          defaultValue={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          className="flex-1"
        />
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
            disabled={pending}
          >
            Clear ({activeCount})
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="online-toggle"
          checked={filters.showOnline}
          onCheckedChange={(checked) => update({ showOnline: checked === true })}
        />
        <Label htmlFor="online-toggle" className="text-sm">
          Show online events {filters.showOnline ? "" : "(hidden by default)"}
        </Label>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Region
        </div>
        <div className="flex flex-wrap gap-1.5">
          {UTAH_REGIONS.map((r) => {
            const on = filters.regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => update({ regions: toggleArrayItem(filters.regions, r) as UtahRegion[] })}
              >
                <Badge variant={on ? "default" : "outline"} className="cursor-pointer">
                  {r}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {cities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            City
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
            {cities.map((c) => {
              const on = filters.cities.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ cities: toggleArrayItem(filters.cities, c) })}
                >
                  <Badge variant={on ? "default" : "outline"} className="cursor-pointer">
                    {c}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Tag
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
            {tags.map((t) => {
              const on = filters.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ tags: toggleArrayItem(filters.tags, t) })}
                >
                  <Badge variant={on ? "default" : "outline"} className="cursor-pointer">
                    {t}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <Label htmlFor="from-date">From</Label>
        <Input
          id="from-date"
          type="date"
          defaultValue={filters.from ?? ""}
          onChange={(e) => update({ from: e.target.value || undefined })}
          className="h-8 w-auto"
        />
        <Label htmlFor="to-date">To</Label>
        <Input
          id="to-date"
          type="date"
          defaultValue={filters.to ?? ""}
          onChange={(e) => update({ to: e.target.value || undefined })}
          className="h-8 w-auto"
        />
      </div>
    </div>
  );
}
