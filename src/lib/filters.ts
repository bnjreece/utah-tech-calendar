import type { UtahRegion } from "./regions";

export type EventType = "conference" | "paid" | "free" | "penciled";

export const TYPE_LABELS: Record<EventType, string> = {
  conference: "Conference",
  paid: "Paid",
  free: "Free",
  penciled: "Penciled in",
};

export interface FilterState {
  q: string;
  regions: UtahRegion[];
  cities: string[];
  tags: string[];
  sources: string[];
  groups: string[];
  types: EventType[];
  from?: string;
  to?: string;
  showOnline: boolean;
}

export const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Community",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

export function parseFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>): FilterState {
  const get = (k: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(k) ?? undefined;
    }
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const csv = (k: string): string[] => {
    const raw = get(k);
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const validTypes: EventType[] = ["conference", "paid", "free", "penciled"];
  const types = csv("types").filter((t): t is EventType => validTypes.includes(t as EventType));

  return {
    q: get("q") ?? "",
    regions: csv("regions") as UtahRegion[],
    cities: csv("cities"),
    tags: csv("tags"),
    sources: csv("sources"),
    groups: csv("groups"),
    types,
    from: get("from"),
    to: get("to"),
    showOnline: get("online") === "show",
  };
}

export function filtersToSearchParams(f: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.regions.length) sp.set("regions", f.regions.join(","));
  if (f.cities.length) sp.set("cities", f.cities.join(","));
  if (f.tags.length) sp.set("tags", f.tags.join(","));
  if (f.sources.length) sp.set("sources", f.sources.join(","));
  if (f.groups.length) sp.set("groups", f.groups.join(","));
  if (f.types.length) sp.set("types", f.types.join(","));
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.showOnline) sp.set("online", "show");
  return sp;
}
