/* Mountain Time formatters. Every event-facing date/time render must
   route through these so server (Vercel functions, default UTC) and
   client agree on the same wall-clock - the website's audience is
   Utah, so we anchor to America/Denver regardless of where the code
   runs or what the visitor's browser reports.

   Without these, JS Date.toLocaleString() on a Vercel Function would
   render in UTC: an event stored as `2026-06-03 01:00 UTC` (correctly =
   7pm Tue MDT) prints as "1:00am Wed" instead of "7:00pm Tue". This
   was the source of the "midnight/3am UTC artifacts" the cross-check
   surfaced. */

const ZONE = "America/Denver";

export function mtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONE,
  });
}

export function mtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(d).toLocaleDateString("en-US", { ...opts, timeZone: ZONE });
}

export function mtDateTime(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(d).toLocaleString("en-US", { ...opts, timeZone: ZONE });
}

export function mtWeekday(d: Date | string, width: "short" | "long" = "short"): string {
  return mtDate(d, { weekday: width });
}

export function mtMonth(d: Date | string, width: "short" | "long" = "short"): string {
  return mtDate(d, { month: width });
}

export function mtDay(d: Date | string): string {
  return mtDate(d, { day: "numeric" });
}

/* Day-of-month as a number, anchored to Mountain Time. Use this instead
   of `date.getDate()` whenever the result is rendered to a user. On a
   Vercel Function (UTC), `getDate()` returns the UTC day, which is
   off-by-one for any evening-Utah event whose UTC timestamp is in the
   next calendar day. */
export function mtDayNum(d: Date | string): number {
  return parseInt(mtDate(d, { day: "numeric" }), 10);
}

export function mtYear(d: Date | string): number {
  return parseInt(mtDate(d, { year: "numeric" }), 10);
}

/* Stable day key (YYYY-MM-DD in Denver) for grouping events into
   per-day buckets. */
export function mtDayKey(d: Date | string): string {
  const date = new Date(d);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}
