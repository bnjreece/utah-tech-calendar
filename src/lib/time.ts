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

function safeDate(d: Date | string): Date | null {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* Day-of-month as a number, anchored to Mountain Time. Use this instead
   of `date.getDate()` whenever the result is rendered to a user. On a
   Vercel Function (UTC), `getDate()` returns the UTC day, which is
   off-by-one for any evening-Utah event whose UTC timestamp is in the
   next calendar day. Returns NaN for Invalid Date so call sites can
   `Number.isFinite()`-guard rather than rendering a misleading "0". */
export function mtDayNum(d: Date | string): number {
  const date = safeDate(d);
  if (!date) return NaN;
  return parseInt(mtDate(date, { day: "numeric" }), 10);
}

export function mtYear(d: Date | string): number {
  const date = safeDate(d);
  if (!date) return NaN;
  return parseInt(mtDate(date, { year: "numeric" }), 10);
}

/* Stable day key (YYYY-MM-DD in Denver) for grouping events into
   per-day buckets. Returns the literal "invalid" for malformed input
   so a single bad row can't crash `groupEventsByDay`. */
export function mtDayKey(d: Date | string): string {
  const date = safeDate(d);
  if (!date) return "invalid";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/* Year+month key for change detection - "06" alone is ambiguous across
   years; this keeps the banner correct if a list ever spans
   December into the next year. */
export function mtMonthKey(d: Date | string): string {
  const date = safeDate(d);
  if (!date) return "invalid";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

/* Denver day keys from today through this Sunday (a Monday-to-Sunday
   week, so on a Sunday it is just today). Steps in 12-hour hops so a
   23- or 25-hour DST day can't skip or repeat a key. */
export function mtRestOfWeekKeys(now: Date = new Date()): Set<string> {
  const keys = new Set<string>();
  for (let h = 0; h <= 8 * 24; h += 12) {
    const d = new Date(now.getTime() + h * 3_600_000);
    keys.add(mtDayKey(d));
    if (mtDate(d, { weekday: "short" }) === "Sun") break;
  }
  return keys;
}

/* How many of these start between now and the end of Sunday, Denver time. */
export function countThisWeek(starts: ReadonlyArray<Date | string>, now: Date = new Date()): number {
  const keys = mtRestOfWeekKeys(now);
  return starts.filter((s) => new Date(s).getTime() >= now.getTime() && keys.has(mtDayKey(s))).length;
}
