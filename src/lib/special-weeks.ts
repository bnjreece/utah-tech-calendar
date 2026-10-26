import { mtDayKey } from "./time";

/* Special weeks: a city-wide event week (Utah Hard Tech Week) gets a tag, a
   filter chip, and a dated homepage banner. Each week is one entry here;
   nothing else in the codebase names a specific week. Pure (no DB) so the
   matcher and the date windows are unit tested.

   An event carries the week's tag when
   - its source injects it (sources.config.defaultTags on the official
     calendar's source row), or
   - its title matches `titlePattern` and it starts inside the event window.
   The title rule is applied at scrape time (stored in events.tags) AND at
   query time (lib/queries.ts), so rows scraped before the week was defined
   are included without a data fix. Dates are America/Denver calendar days,
   inclusive. */

export interface SpecialWeek {
  /* Tag stored on events and used in URLs (/tag/<slug>, ?tags=<slug>). */
  slug: string;
  label: string;
  /* One line for the banner. No em dashes. */
  blurb: string;
  /* Days the event week runs (title matching only counts inside it). */
  eventFrom: string;
  eventTo: string;
  /* Days the homepage banner and filter chip show. */
  bannerFrom: string;
  bannerTo: string;
  /* Case-insensitive. Kept to syntax JS and Postgres (~*) read the same way:
     literals, |, ?, groups. */
  titlePattern: string;
  /* The organizer's own page, linked from the banner. */
  officialUrl?: string;
}

export const SPECIAL_WEEKS: SpecialWeek[] = [
  {
    slug: "hard-tech-week",
    label: "Hard Tech Week",
    blurb: "Five days of hard tech events across Utah, with Zero Gravity Summit at the Salt Palace Oct 28 and 29.",
    eventFrom: "2026-10-26",
    eventTo: "2026-10-30",
    bannerFrom: "2026-10-19",
    bannerTo: "2026-10-30",
    titlePattern: "hard ?tech week|zero gravity summit|hard tech hackathon",
    officialUrl: "https://luma.com/47g-hardtechweek",
  },
];

export function getSpecialWeek(slug: string): SpecialWeek | undefined {
  return SPECIAL_WEEKS.find((w) => w.slug === slug);
}

/* The week's landing page (/tag/<slug> resolves a special week before any
   row is tagged), which the banner points at: an indexable page, unlike
   the noindex filtered homepage view. The homepage chip still filters in
   place via ?tags=. */
export function specialWeekHref(w: SpecialWeek): string {
  return `/tag/${encodeURIComponent(w.slug)}`;
}

function inDays(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/* Weeks whose banner (and chip) should show at `now`. */
export function activeSpecialWeeks(now: Date = new Date()): SpecialWeek[] {
  const day = mtDayKey(now);
  return SPECIAL_WEEKS.filter((w) => inDays(day, w.bannerFrom, w.bannerTo));
}

/* Week tags an event earns by its title and start date. */
export function specialWeekTagsFor(item: { title: string; startsAt: Date }): string[] {
  const day = mtDayKey(item.startsAt);
  return SPECIAL_WEEKS.filter(
    (w) => inDays(day, w.eventFrom, w.eventTo) && new RegExp(w.titlePattern, "i").test(item.title),
  ).map((w) => w.slug);
}

export const SPECIAL_WEEK_SLUGS: ReadonlySet<string> = new Set(SPECIAL_WEEKS.map((w) => w.slug));

/* Display label for a tag, special weeks first. */
export function tagLabel(tag: string): string {
  return getSpecialWeek(tag)?.label ?? tag;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "Oct 26 to 30" / "Oct 30 to Nov 3" from the week's own day strings
   (never through Date, which would shift a bare day across time zones). */
export function specialWeekDates(w: SpecialWeek): string {
  const [, fm, fd] = w.eventFrom.split("-").map(Number);
  const [, tm, td] = w.eventTo.split("-").map(Number);
  const from = `${MONTHS[fm - 1]} ${fd}`;
  if (w.eventFrom === w.eventTo) return from;
  return fm === tm ? `${from} to ${td}` : `${from} to ${MONTHS[tm - 1]} ${td}`;
}
