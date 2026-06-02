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
  utah_geek_events: "Utah Geek Events",
  /* HTML-calendar adapter sources all share source='html'. The per-
     source friendly label (BioUtah, Altitude Lab, SAINTCON, etc.)
     lives in source.config.sourceLabel and gets resolved by callers
     that have the source row. For event-card rendering where we only
     have event.source, fall through to this generic label. */
  html: "Web",
  /* Recurrence-adapter series get an explicit label per slug. Add an
     entry whenever you stand up a new `recurrence:<slug>` source so
     event cards, filter chips, and OG images render cleanly. */
  "recurrence:1mc-slc": "1 Million Cups",
  "recurrence:cto-breakfast-utah": "CTO Breakfast",
};

/* Resolve a raw source identifier to a display label. Use this in any
   UI render path that surfaces `event.source` to a human - falls back
   to a humanized slug for recurrence sources that haven't been added
   to SOURCE_LABELS yet, and to the raw string for anything else. */
export function sourceLabel(source: string | undefined | null): string {
  if (!source) return "";
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  if (source.startsWith("recurrence:")) {
    return source
      .slice("recurrence:".length)
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return source;
}

export function parseFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>): FilterState {
  const get = (k: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(k) ?? undefined;
    }
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  /* Cap per-bucket array length so a malicious feedQuery can't smuggle
     hundreds of comma-separated tags into the digest cron's queryEvents
     and burn function time on a 1000-element ARRAY[...] bind every
     week. Real users never need more than a handful per bucket. */
  const MAX_PER_BUCKET = 25;
  const csv = (k: string): string[] => {
    const raw = get(k);
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_PER_BUCKET);
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
