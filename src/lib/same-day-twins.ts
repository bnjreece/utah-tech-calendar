import { normalizeEventTitle } from "./autopilot";
import { mtDayKey } from "./time";
import { SPECIAL_WEEK_SLUGS } from "./special-weeks";

/* Same-day twins: one event listed more than once, under the same title on
   the same Denver day at start times close together. The cross-post sweep
   (dedup-sweep.ts) groups by exact start time within one source, so it
   misses the same event on two calendars or two sources: an Eventbrite or
   Tickettailor listing that the official Hard Tech Week calendar links to,
   or a Silicon Slopes listing the calendar repeats.

   Title + day + time alone is not identity: two groups can each run a
   "Monthly Meetup" the same evening in different cities. So a pair is only
   a twin when it ALSO has one piece of identity evidence:
   - the same link (lu.ma and luma.com count as one host; query and
     fragment ignored);
   - the same venue: the same venue name, or map pins within 250 m;
   - one row is a Luma calendar's external listing (externalId calev-...),
     which is only a pointer to an event hosted elsewhere, and both start at
     the same minute.
   A row with none of these stays visible even when the title matches.

   A deleted-and-reposted Luma listing (the July Hard Tech Week Opening
   Party at Clark Planetarium) has a different venue, link and time from its
   replacement, so it is NOT caught here; it is hidden by hand
   (ops/2026-10-25). Freshness still ranks which twin is kept.

   Pure: the sweep loads the rows and applies the result. */

export interface TwinRow {
  id: string;
  title: string;
  source: string;
  externalId: string | null;
  link: string | null;
  venueName: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  startsAt: Date;
  createdAt: Date;
  updatedAt: Date;
  statusLocked: boolean;
  tags: string[] | null;
}

/* Starts further apart than this are treated as separate sessions. */
export const TWIN_WINDOW_MS = 90 * 60 * 1000;
/* A scraped row not refreshed for this long is no longer being seen
   upstream (scrapes run every 3 hours and refresh updated_at). */
export const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
/* Two map pins this close are one venue. */
export const SAME_VENUE_METERS = 250;

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;
const PLACEHOLDER_VENUE_RE = /^(online|virtual|zoom|tbd|tba|to be (announced|determined)|none)$/;

export function normalizeLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^luma\.com$/, "lu.ma");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/* The venue's name (first comma segment), letters and digits only. */
function venueKey(v: string | null): string | null {
  if (!v) return null;
  const k = v.split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return k && !PLACEHOLDER_VENUE_RE.test(k) ? k : null;
}

function coords(r: TwinRow): [number, number] | null {
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  if (r.latitude == null || r.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function metersApart(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) / 2) * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

function isCalendarPointer(r: TwinRow): boolean {
  return r.source === "luma" && Boolean(r.externalId?.startsWith("calev-"));
}

/* Identity evidence beyond title, day and time (see the header). */
export function sameEventEvidence(a: TwinRow, b: TwinRow): boolean {
  const la = normalizeLink(a.link);
  if (la && la === normalizeLink(b.link)) return true;
  const va = venueKey(a.venueName);
  if (va && va === venueKey(b.venueName)) return true;
  const ca = coords(a);
  const cb = coords(b);
  if (ca && cb && metersApart(ca, cb) <= SAME_VENUE_METERS) return true;
  if ((isCalendarPointer(a) || isCalendarPointer(b)) && a.startsAt.getTime() === b.startsAt.getTime())
    return true;
  return false;
}

function rank(r: TwinRow, now: Date): number[] {
  /* Lower sorts first = kept. A human-locked row wins, then a row still
     being seen upstream (manual rows are never refreshed by a scrape, so
     they always count as current), then the oldest. */
  const fresh = r.source === "manual" || now.getTime() - r.updatedAt.getTime() < STALE_AFTER_MS;
  return [r.statusLocked ? 0 : 1, fresh ? 0 : 1, r.createdAt.getTime()];
}

function compare(a: TwinRow, b: TwinRow, now: Date): number {
  const ra = rank(a, now);
  const rb = rank(b, now);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface TwinCluster {
  key: string;
  keep: TwinRow;
  drop: TwinRow[];
  /* Special-week tags a dropped row carries and the kept row lacks. The
     sweep adds them to the kept row so hiding a duplicate never takes the
     event out of a week's filtered view (the official Hard Tech Week
     calendar tags its own listing; the older Eventbrite row it duplicates
     does not have the tag, and its title may not earn it). */
  carryTags: string[];
}

/* Group approved rows into twin clusters. Each cluster keeps its best row
   and drops the others that start within TWIN_WINDOW_MS of it AND have
   identity evidence with it. Rows left over form their own clusters.
   Locked rows are never dropped. */
export function findSameDayTwins(rows: TwinRow[], now: Date): TwinCluster[] {
  const groups = new Map<string, TwinRow[]>();
  for (const r of rows) {
    const t = normalizeEventTitle(r.title);
    if (!t || PLACEHOLDER_TITLE_RE.test(t)) continue;
    const key = `${t}|${mtDayKey(r.startsAt)}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const out: TwinCluster[] = [];
  for (const [key, g] of groups) {
    let rest = [...g].sort((a, b) => compare(a, b, now));
    while (rest.length >= 2) {
      const [keep, ...others] = rest;
      const drop = others.filter(
        (r) =>
          !r.statusLocked &&
          Math.abs(r.startsAt.getTime() - keep.startsAt.getTime()) <= TWIN_WINDOW_MS &&
          sameEventEvidence(keep, r),
      );
      if (drop.length > 0) {
        const have = new Set(keep.tags ?? []);
        const carry = new Set<string>();
        for (const d of drop)
          for (const t of d.tags ?? []) if (SPECIAL_WEEK_SLUGS.has(t) && !have.has(t)) carry.add(t);
        out.push({ key, keep, drop, carryTags: [...carry] });
      }
      rest = others.filter((r) => !drop.includes(r));
    }
  }
  return out;
}
