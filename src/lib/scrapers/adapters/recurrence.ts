import type { Adapter, AdapterConfig, EventItem } from "../types";

/* Recurrence adapter - synthesizes EventItems from a config blob
   instead of fetching a remote page. Useful for stable recurring
   community events that don't expose a scrape-friendly listing:
   weekly meetups, monthly breakfasts, etc.

   Each source row of adapter=recurrence carries its pattern in
   sources.config. The URL field is the canonical listing the user
   should click for the current venue/details - it gets stamped into
   every generated event's `link` field.

   Two pattern types:
     { type: "weekly", weekday: 0-6, hour, minute, ... }
       -> next N weeks at the same local time
     { type: "monthly_nth", weekday: 0-6, nth: 1-5, hour, minute, ... }
       -> Nth weekday of each month (e.g., 2nd Friday) for next N months

   `weekday` follows JS convention: 0=Sunday, 6=Saturday.
   All times are interpreted as America/Denver wall clock - the
   adapter resolves to the correct UTC instant via Intl, so an event
   stays at 9am MT through both MDT and MST. */

type RecurrenceConfig =
  | WeeklyConfig
  | MonthlyNthConfig;

interface BaseConfig {
  /* Stable kebab-case identifier for this series. The adapter uses it
     to build `source: recurrence:<slug>` and `externalId: <slug>-<date>`,
     so two source rows with identical titles can coexist as long as
     their slugs differ. */
  slug: string;
  title: string;
  description?: string;
  /* Local wall clock in America/Denver */
  hour: number;
  minute?: number;
  /* Length of the event in minutes; defaults to 90 */
  durationMinutes?: number;
  /* Geography - city is required for region categorization;
     leave venueName/address blank when the venue varies per
     instance and the canonical link carries the real one. */
  city: string;
  state?: string;
  venueName?: string;
  address?: string;
  postalCode?: string;
  isOnline?: boolean;
  tags?: string[];
  /* How many future instances to materialize per scrape run.
     Defaults are sensible for the pattern: 26 weekly, 12 monthly. */
  countAhead?: number;
}

interface WeeklyConfig extends BaseConfig {
  type: "weekly";
  /* 0=Sun, 6=Sat */
  weekday: number;
}

interface MonthlyNthConfig extends BaseConfig {
  type: "monthly_nth";
  weekday: number;
  /* 1=first, 2=second, ... 5=fifth (skips months without a 5th) */
  nth: number;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/* Build a UTC Date for a wall-clock instant in America/Denver. Two-
   candidate round-trip check handles DST without leaking an hour. On
   the spring-forward skipped hour (e.g. Mar 8 2026 02:00 Denver) neither
   offset round-trips, so we throw rather than silently materialize a
   wrong-hour event. The fall-back repeated hour (Nov 1 2026 01:00) IS
   ambiguous; we deliberately resolve to the earlier (MDT) instant so
   the rendered local time stays consistent for the rest of the year. */
function denverInstant(y: number, mo: number, d: number, h: number, mi: number): Date {
  const probe = (offsetH: number): Date | null => {
    const candidate = new Date(Date.UTC(y, mo - 1, d, h + offsetH, mi));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const get = (t: string) => parts.find((x) => x.type === t)?.value;
    if (
      Number(get("year")) === y &&
      Number(get("month")) === mo &&
      Number(get("day")) === d &&
      Number(get("hour")) === h &&
      Number(get("minute")) === mi
    ) {
      return candidate;
    }
    return null;
  };
  const mdt = probe(6);
  if (mdt) return mdt;
  const mst = probe(7);
  if (mst) return mst;
  throw new Error(
    `denverInstant: ${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)} does not exist in America/Denver (DST skipped hour)`,
  );
}

function nextWeeklyDates(weekday: number, count: number, from: Date): Date[] {
  const dates: Date[] = [];
  /* Start from `from`'s local Denver date, find the next matching
     weekday (or today if it's already that weekday and hasn't started
     yet - that "hasn't started" check happens in the caller after
     building the instant). */
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(from);
  const startY = Number(ymd.find((p) => p.type === "year")?.value);
  const startM = Number(ymd.find((p) => p.type === "month")?.value);
  const startD = Number(ymd.find((p) => p.type === "day")?.value);
  /* JS Date for arithmetic only - we don't store this directly. */
  const cursor = new Date(Date.UTC(startY, startM - 1, startD, 12, 0));
  const cursorWeekday = cursor.getUTCDay();
  const daysAhead = (weekday - cursorWeekday + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + daysAhead);
  for (let i = 0; i < count; i++) {
    dates.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

function nthWeekdayOfMonth(year: number, month1to12: number, weekday: number, nth: number): Date | null {
  /* Walk Jan 1 of the target month, find the first matching weekday,
     advance by 7*(nth-1) days. If that overflows the month, return
     null. */
  const first = new Date(Date.UTC(year, month1to12 - 1, 1, 12, 0));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + 7 * (nth - 1);
  const tentative = new Date(Date.UTC(year, month1to12 - 1, day, 12, 0));
  if (tentative.getUTCMonth() !== month1to12 - 1) return null;
  return tentative;
}

function nextMonthlyNthDates(weekday: number, nth: number, count: number, from: Date): Date[] {
  const dates: Date[] = [];
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);
  let y = Number(ymd.find((p) => p.type === "year")?.value);
  let m = Number(ymd.find((p) => p.type === "month")?.value);
  while (dates.length < count) {
    const candidate = nthWeekdayOfMonth(y, m, weekday, nth);
    if (candidate && candidate.getTime() >= from.getTime() - 24 * 60 * 60 * 1000) {
      dates.push(candidate);
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    /* Safety stop - 5 years out and we're well past anything useful. */
    if (y > new Date().getUTCFullYear() + 5) break;
  }
  return dates;
}

function isValidConfig(c: unknown): c is RecurrenceConfig {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  const isInt = (v: unknown, lo: number, hi: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  if (typeof o.slug !== "string" || !/^[a-z0-9-]+$/.test(o.slug)) return false;
  if (typeof o.title !== "string" || !o.title) return false;
  if (typeof o.city !== "string" || !o.city) return false;
  if (!isInt(o.hour, 0, 23)) return false;
  if (o.minute !== undefined && !isInt(o.minute, 0, 59)) return false;
  if (o.durationMinutes !== undefined && !isInt(o.durationMinutes, 1, 24 * 60)) return false;
  if (o.countAhead !== undefined && !isInt(o.countAhead, 1, 104)) return false;
  if (o.type === "weekly") {
    return isInt(o.weekday, 0, 6);
  }
  if (o.type === "monthly_nth") {
    return isInt(o.weekday, 0, 6) && isInt(o.nth, 1, 5);
  }
  return false;
}

export const recurrenceAdapter: Adapter<EventItem> = {
  name: "recurrence",
  runtime: "synthetic",
  async scrape({ url, sourceConfig }: AdapterConfig) {
    if (!isValidConfig(sourceConfig)) {
      throw new Error("recurrence adapter: invalid or missing sources.config");
    }
    const cfg = sourceConfig;
    const hour = cfg.hour;
    const minute = cfg.minute ?? 0;
    const durationMinutes = cfg.durationMinutes ?? 90;
    const count =
      cfg.countAhead ?? (cfg.type === "weekly" ? 26 : 12);
    const now = new Date();

    const dates =
      cfg.type === "weekly"
        ? nextWeeklyDates(cfg.weekday, count, now)
        : nextMonthlyNthDates(cfg.weekday, cfg.nth, count, now);

    const items: EventItem[] = [];
    const cutoff = now.getTime() - 60 * 60 * 1000; // 1h grace, then drop
    for (const dateOnly of dates) {
      const y = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric" })
          .formatToParts(dateOnly).find((p) => p.type === "year")?.value,
      );
      const m = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", month: "2-digit" })
          .formatToParts(dateOnly).find((p) => p.type === "month")?.value,
      );
      const d = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", day: "2-digit" })
          .formatToParts(dateOnly).find((p) => p.type === "day")?.value,
      );
      const startsAt = denverInstant(y, m, d, hour, minute);
      /* Skip instances that have already started (with 1h grace for an
         event still in progress). Without this the weekly path would
         materialize today's 9am instance at 3pm even though it's done. */
      if (startsAt.getTime() < cutoff) continue;
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
      const dateKey = `${y}-${pad(m)}-${pad(d)}`;
      items.push({
        source: `recurrence:${cfg.slug}`,
        externalId: `${cfg.slug}-${dateKey}`,
        title: cfg.title,
        description: cfg.description,
        link: url,
        startsAt,
        endsAt,
        isOnline: cfg.isOnline ?? false,
        venueName: cfg.venueName,
        address: cfg.address,
        city: cfg.city,
        postalCode: cfg.postalCode,
        tags: cfg.tags,
      });
    }
    return items;
  },
};
