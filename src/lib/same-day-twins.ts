import { normalizeEventTitle } from "./autopilot";
import { mtDayKey } from "./time";

/* Same-day twins: one event listed more than once, under the same title on
   the same Denver day at start times close together. The cross-post sweep
   (dedup-sweep.ts) groups by exact start time within one source, so it
   misses the same event on two calendars or two sources: an Eventbrite or
   Tickettailor listing that the official Hard Tech Week calendar links to,
   or a Silicon Slopes listing the calendar repeats.

   Title + day + time alone is not identity: two groups can each run a
   "Monthly Meetup" the same evening in different cities, and one host can
   run the same tour twice an hour apart. So a pair is only a twin when it
   ALSO has identity evidence, and the evidence needed depends on time:
   - Different start minutes: only the same link (lu.ma and luma.com count
     as one host; fragment and click-tracking query keys ignored, any other
     query key kept), and only across two sources.
     One source listing a title twice at two times is two sessions.
   - The same start minute: the same link, or, when the two locations do
     not conflict, the same venue (same venue name, or map pins within
     250 m), or one row being a Luma
     calendar's external listing (externalId calev-...), which is only a
     pointer to an event hosted elsewhere.
   Locations conflict when both rows have map pins more than 1 km apart,
   or both venues go on past the name (a street or a city) and that next
   part differs ("Kiln, 26 S Rio Grande St, Salt Lake City" vs "Kiln, 2701
   N Thanksgiving Way, Lehi", or "Kiln, Salt Lake City" vs "Kiln, Lehi").
   Conflicting locations rule out a twin even under the same link.
   A row with none of this evidence stays visible even when the title
   matches: a missed duplicate is a nuisance, a hidden event is a loss.

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
}

/* Starts further apart than this are treated as separate sessions. */
export const TWIN_WINDOW_MS = 90 * 60 * 1000;
/* A scraped row not refreshed for this long is no longer being seen
   upstream (scrapes run every 3 hours and refresh updated_at). */
export const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
/* Two map pins this close are one venue. */
export const SAME_VENUE_METERS = 250;
/* Two map pins further apart than this are two places, whatever the venue
   names say (geocoders can put one building a few hundred meters apart). */
export const CONFLICT_METERS = 1000;

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;
const PLACEHOLDER_VENUE_RE = /^(online|virtual|zoom|tbd|tba|to be (announced|determined)|none)$/;

/* Query keys that only say where a click came from, never which event it
   is (utm_source=luma, Eventbrite's aff=..., GrowthZone's
   sourceTypeId=Website). Every other key is kept: on many sites the event
   is the query ("event?id=101"), and two such links must stay apart. */
const TRACKING_PARAM_RE =
  /^(utm(_.*)?|aff|ref|ref_src|referrer|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_gl|_ga|igshid|si|trk|sourcetypeid|calendarmonth)$/;

export function normalizeLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^luma\.com$/, "lu.ma");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const query = [...u.searchParams]
      .filter(([k]) => !TRACKING_PARAM_RE.test(k.toLowerCase()))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join("&");
    return query ? `${host}${path}?${query}` : `${host}${path}`;
  } catch {
    return null;
  }
}

function venueParts(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean);
}

/* The venue's name (first comma segment), letters and digits only. */
function venueKey(v: string | null): string | null {
  const k = venueParts(v)[0];
  return k && !PLACEHOLDER_VENUE_RE.test(k) ? k : null;
}

/* What follows the name (second comma segment: a street or a city). */
function venueStreet(v: string | null): string | null {
  return venueParts(v)[1] ?? null;
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

/* True when the two rows are known to be in different places. */
export function locationsConflict(a: TwinRow, b: TwinRow): boolean {
  const ca = coords(a);
  const cb = coords(b);
  if (ca && cb && metersApart(ca, cb) > CONFLICT_METERS) return true;
  const sa = venueStreet(a.venueName);
  const sb = venueStreet(b.venueName);
  return Boolean(sa && sb && sa !== sb);
}

/* Identity evidence beyond title, day and time (see the header). */
export function sameEventEvidence(a: TwinRow, b: TwinRow): boolean {
  /* Known different places are two events, even under one link: a shared
     registration page can front several venues. */
  if (locationsConflict(a, b)) return false;
  const la = normalizeLink(a.link);
  const sameLink = Boolean(la && la === normalizeLink(b.link));
  if (a.startsAt.getTime() !== b.startsAt.getTime()) return sameLink && a.source !== b.source;
  if (sameLink) return true;
  const va = venueKey(a.venueName);
  if (va && va === venueKey(b.venueName)) return true;
  const ca = coords(a);
  const cb = coords(b);
  if (ca && cb && metersApart(ca, cb) <= SAME_VENUE_METERS) return true;
  return isCalendarPointer(a) || isCalendarPointer(b);
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
      if (drop.length > 0) out.push({ key, keep, drop });
      rest = others.filter((r) => !drop.includes(r));
    }
  }
  return out;
}
