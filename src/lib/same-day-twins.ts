import { normalizeEventTitle } from "./autopilot";
import { mtDayKey } from "./time";

/* Same-day twins: one event listed more than once under the same title on
   the same Denver day, at start times close together. The cross-post sweep
   (dedup-sweep.ts) groups by exact start time within one source, so it
   misses:
   - a stale listing the organizer deleted and re-posted at a new time or
     venue (Hard Tech Week Opening Party: the July "save the date" at 6:30pm
     and the real 6:00pm listing). Nothing re-scrapes a deleted listing, so
     its row just stops updating;
   - the same event on two calendars or two sources (a 47G calendar entry
     and the official Hard Tech Week calendar entry for Zero Gravity Summit,
     or an Eventbrite listing that a Luma calendar links to).
   Same title + same day is the autopilot's duplicate rule too (pendingFacts);
   the start-time window keeps two genuine sessions hours apart apart.

   Pure: the sweep loads the rows and applies the result. */

export interface TwinRow {
  id: string;
  title: string;
  source: string;
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

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;

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
   and drops the others that start within TWIN_WINDOW_MS of it. Locked rows
   are never dropped. */
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
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => compare(a, b, now));
    const keep = sorted[0];
    const drop = sorted
      .slice(1)
      .filter(
        (r) =>
          !r.statusLocked &&
          Math.abs(r.startsAt.getTime() - keep.startsAt.getTime()) <= TWIN_WINDOW_MS,
      );
    if (drop.length > 0) out.push({ key, keep, drop });
  }
  return out;
}
