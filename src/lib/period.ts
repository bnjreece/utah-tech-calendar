/* Period helpers for date archive landing pages at /events/[period].

   Slug grammar:
     january-2026, february-2026, ... (single month)

   Earlier draft also emitted season slugs (winter/spring/summer/fall) but
   they overlapped with the month slugs - May 2026 and Summer 2026 cover
   substantially the same set of events, two indexed URLs both ranking for
   roughly the same query. Months alone give clean canonical pages. We can
   re-add seasons later if traffic data shows distinct intent. */

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

export interface PeriodRange {
  from: Date;
  to: Date;
  display: string;
  monthIndex: number;
  year: number;
}

export function parsePeriod(slug: string): PeriodRange | null {
  const m = slug.match(/^([a-z]+)-(\d{4})$/);
  if (!m) return null;
  const [, name, yearStr] = m;
  const year = Number(yearStr);
  if (year < 2024 || year > 2030) return null;

  const monthIdx = MONTH_NAMES.indexOf(name as typeof MONTH_NAMES[number]);
  if (monthIdx < 0) return null;

  const from = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0));
  return {
    from,
    to,
    display: `${MONTH_NAMES[monthIdx][0].toUpperCase()}${MONTH_NAMES[monthIdx].slice(1)} ${year}`,
    monthIndex: monthIdx,
    year,
  };
}

/* Slugs for the current month + next 11. Past months never make it into
   the sitemap so we don't ship thin pages full of past events. */
export function listUpcomingPeriodSlugs(now = new Date()): string[] {
  const slugs: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    slugs.push(`${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`);
  }
  return slugs;
}
