/* Period helpers for date archive landing pages at /events/[period].

   Slug grammar:
     january-2026, february-2026, ... (single month)
     winter-2026, spring-2026, summer-2026, fall-2026 (season)

   Each slug resolves to a [from, to] date range used to filter events.
   Used by both the page route and the sitemap generator. */

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

const SEASONS: Record<string, [number, number]> = {
  winter: [11, 1], /* Dec, Jan, Feb - spans year boundary */
  spring: [2, 4],
  summer: [5, 7],
  fall: [8, 10],
};

export interface PeriodRange {
  from: Date;
  to: Date;
  display: string;
  monthIndex?: number;
  year: number;
}

export function parsePeriod(slug: string): PeriodRange | null {
  const m = slug.match(/^([a-z]+)-(\d{4})$/);
  if (!m) return null;
  const [, name, yearStr] = m;
  const year = Number(yearStr);
  if (year < 2024 || year > 2030) return null;

  const monthIdx = MONTH_NAMES.indexOf(name as typeof MONTH_NAMES[number]);
  if (monthIdx >= 0) {
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

  const season = SEASONS[name];
  if (season) {
    const [startMonth, endMonth] = season;
    /* Winter wraps across the year boundary (Dec-Feb). The slug "winter-2026"
       means December 2025 - February 2026 by convention. */
    if (name === "winter") {
      const from = new Date(Date.UTC(year - 1, 11, 1));
      const to = new Date(Date.UTC(year, 2, 1));
      return { from, to, display: `Winter ${year}`, year };
    }
    const from = new Date(Date.UTC(year, startMonth, 1));
    const to = new Date(Date.UTC(year, endMonth + 1, 1));
    return {
      from,
      to,
      display: `${name[0].toUpperCase()}${name.slice(1)} ${year}`,
      year,
    };
  }

  return null;
}

/* Generate slugs for the upcoming windows we want indexable. Today's
   month + the next 11 months + each of the next 4 seasons. */
export function listUpcomingPeriodSlugs(now = new Date()): string[] {
  const slugs: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    slugs.push(`${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`);
  }
  const seasonSlugs = ["winter", "spring", "summer", "fall"];
  for (let i = 0; i < 4; i++) {
    const baseMonth = now.getUTCMonth() + i * 3;
    const d = new Date(Date.UTC(now.getUTCFullYear(), baseMonth, 1));
    const seasonIndex = Math.floor(d.getUTCMonth() / 3);
    slugs.push(`${seasonSlugs[seasonIndex]}-${d.getUTCFullYear()}`);
  }
  return [...new Set(slugs)];
}
