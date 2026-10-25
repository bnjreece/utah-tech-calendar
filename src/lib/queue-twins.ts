import { NOT_COMMUNITY_RE, normalizeEventTitle } from "./autopilot";
import {
  locationsConflict,
  normalizeLink,
  PLACEHOLDER_VENUE_RE,
  sameEventEvidence,
  STALE_AFTER_MS,
  TWIN_WINDOW_MS,
  type TwinRow,
} from "./same-day-twins";
import { categorizeRegion } from "./regions";
import { mtDayKey } from "./time";

/* Queue twins: duplicates sitting in the PENDING review queue. The autopilot
   checks for a duplicate only once, when a row is first classified, and only
   against an exact title, so a twin that arrives later or under a slightly
   different title waits for a human ("UVU 2026 Bitcoin Conference: ..." next
   to "2026 Bitcoin Conference: ...", or two TECHSPO listings that differ only
   in a parenthetical). The dedup sweep runs this after every scrape.

   A pending row is a twin of another upcoming row (pending or approved) when
   both start on the same Denver day and
   - the TITLES match: equal after normalization (ticket tiers and
     punctuation dropped, see normalizeEventTitle), equal once a trailing
     parenthetical is dropped, or one contained in the other with at most
     three extra words, none of which names a different part of an event
     ("VIP Section", "After Party", "Day 2", "Part 8", a number); AND
   - there is IDENTITY evidence:
     . the same listing (same link, or the same Eventbrite event id under a
       renamed slug), within 90 minutes; or, at the same start minute and
       with compatible places (below),
     . same venue name or map pins within 250 m (exact or contained title),
       when the locations do not conflict (lib/same-day-twins.ts); a
       placeholder venue ("TBD", "Online", "Zoom") is never a venue; or
     . exact title only, with a title of three or more words so a generic
       "Monthly Meetup" never matches: the same city, or the same source
       with neither row giving more than a city or county as its venue and
       one row's city inside the other's county ("HackerX - Utah County"
       listed at "Provo" and at "Utah County").
   Places are compatible unless both rows name a city and the two differ,
   except a county and a city in it ("Utah County" and "Provo"). Provo and
   Ogden never match, whatever the title or source.
   Different dates never match, so a series ("Part 7" Oct 28, "Part 8"
   Nov 11) is untouched.

   Which row stays: a pending row with an approved twin is hidden (the
   approved row is already public). Among pending twins the kept row is a
   locked one, then an attendee listing over an employer / vendor tier, then
   one still being seen upstream, then the oldest. Locked and manual rows
   are never hidden. Pure: the sweep loads rows and applies the result. */

export interface QueueTwinRow extends TwinRow {
  status: string;
  city: string | null;
}

export interface QueueTwinHide {
  hide: QueueTwinRow;
  keep: QueueTwinRow;
  /* How the titles matched, for the dry run. */
  match: TitleMatch;
}

export type TitleMatch = "exact" | "core" | "contained";

const PLACEHOLDER_TITLE_RE = /^(tbd|tba|to be (announced|determined)|untitled( event)?|event)$/;
/* Extra words that name a different part of an event, not a different
   listing of the same one. */
const DISTINCT_EXTRA_RE =
  /^(vip|section|after|afterparty|pre|post|part|day|night|session|track|workshop|panel|dinner|lunch|luncheon|breakfast|brunch|reception|mixer|happy|hour|kickoff|keynote|demo|office|hours|social|party|meetup|hackathon|training|class|course|webinar|tour|livestream|stream|virtual|online|round|final|finals|\d+)$/;
const MAX_EXTRA_WORDS = 3;
/* The shorter title in a containment match needs this much substance. */
const MIN_CONTAINED_WORDS = 4;
/* An exact title matched on city alone needs this many words. */
const MIN_CITY_MATCH_WORDS = 3;

const PAREN_SUFFIX_RE = /\s*[([]([^)\]]*)[)\]]\s*$/;

/* Title without a trailing (...) or [...] suffix, then normalized. */
export function coreTitle(title: string): string {
  return normalizeEventTitle(title.replace(PAREN_SUFFIX_RE, ""));
}

const words = (s: string) => (s ? s.split(" ") : []);
const parenWords = (title: string) => words(normalizeEventTitle(PAREN_SUFFIX_RE.exec(title)?.[1] ?? ""));
const VIP_RE = /\bvip\b/i;

export function matchTitles(a: string, b: string): TitleMatch | null {
  const fa = normalizeEventTitle(a);
  const fb = normalizeEventTitle(b);
  if (!fa || !fb || PLACEHOLDER_TITLE_RE.test(fa) || PLACEHOLDER_TITLE_RE.test(fb)) return null;
  /* normalizeEventTitle drops "VIP" as a ticket tier, but a VIP section or
     VIP reception is its own event. */
  if (VIP_RE.test(a) !== VIP_RE.test(b)) return null;
  if (fa === fb) return "exact";
  const ca = coreTitle(a);
  const cb = coreTitle(b);
  /* The dropped parentheticals must not name a part of an event either
     ("Summit (Day 2)", "Party (After Party)"). */
  const parens = [...parenWords(a), ...parenWords(b)];
  if (parens.some((w) => DISTINCT_EXTRA_RE.test(w))) return null;
  if (ca && ca === cb && words(ca).length >= MIN_CITY_MATCH_WORDS) return "core";
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  if (words(short).length < MIN_CONTAINED_WORDS) return null;
  const at = ` ${long} `.indexOf(` ${short} `);
  if (at < 0) return null;
  const extra = words(`${long.slice(0, at)} ${long.slice(at + short.length)}`.trim().replace(/\s+/g, " "));
  if (extra.length > MAX_EXTRA_WORDS || extra.some((w) => DISTINCT_EXTRA_RE.test(w))) return null;
  return "contained";
}

/* Eventbrite keeps the numeric event id when an organizer renames the
   listing, so two slugs with one id are one listing. */
export function listingKey(link: string | null | undefined): string | null {
  const n = normalizeLink(link);
  if (!n) return null;
  const eb = /^eventbrite\.[a-z.]+\/e\/(?:.*-)?(\d{9,})$/.exec(n);
  return eb ? `eventbrite:${eb[1]}` : n;
}

const venueName = (v: string | null) =>
  (v ?? "").split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cityKey = (c: string | null) => (c ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* Venue gives no more than a place name: blank, the row's own city, or a
   county / "Utah". A placeholder ("TBD", "Online") is not a place. */
function coarseVenue(r: QueueTwinRow): boolean {
  const v = venueName(r.venueName);
  if (PLACEHOLDER_VENUE_RE.test(v)) return false;
  return !v || v === cityKey(r.city) || /\b(county|utah)$/.test(v);
}

const COUNTY_RE = /^(.+) county$/;

/* "Utah County" contains "Provo" (lib/regions.ts knows Salt Lake and Utah
   counties only, so any other county never contains a city). */
function countyContains(county: string, city: string): boolean {
  const m = COUNTY_RE.exec(county);
  if (!m || !city || COUNTY_RE.test(city)) return false;
  return categorizeRegion({ city }).toLowerCase() === county;
}

/* How the two rows' cities relate: "same" (equal), "county" (a county and
   a city inside it), "unknown" (one or both blank) or "conflict". */
export function placeRelation(a: QueueTwinRow, b: QueueTwinRow): "same" | "county" | "unknown" | "conflict" {
  const ca = cityKey(a.city);
  const cb = cityKey(b.city);
  if (!ca || !cb) return "unknown";
  if (ca === cb) return "same";
  if (countyContains(ca, cb) || countyContains(cb, ca)) return "county";
  return "conflict";
}
const hasPin = (r: QueueTwinRow) => r.latitude != null && r.longitude != null;

export function queueTwinEvidence(a: QueueTwinRow, b: QueueTwinRow, match: TitleMatch): boolean {
  if (mtDayKey(a.startsAt) !== mtDayKey(b.startsAt)) return false;
  const apart = Math.abs(a.startsAt.getTime() - b.startsAt.getTime());
  if (apart > TWIN_WINDOW_MS) return false;
  const la = listingKey(a.link);
  if (la && la === listingKey(b.link)) return true;
  if (apart !== 0) return false;
  const place = placeRelation(a, b);
  if (place === "conflict") return false;
  if (locationsConflict(a, b)) return false;
  if (venueEvidence(a, b)) return true;
  if (match !== "exact") return false;
  /* A Luma calendar's external listing only points at an event hosted
     elsewhere (same rule as same-day-twins.ts). */
  if (isCalendarPointer(a) || isCalendarPointer(b)) return true;
  if (words(normalizeEventTitle(a.title)).length < MIN_CITY_MATCH_WORDS) return false;
  if (place === "same") return true;
  return (
    place === "county" &&
    a.source === b.source &&
    coarseVenue(a) &&
    coarseVenue(b) &&
    !hasPin(a) &&
    !hasPin(b)
  );
}

function isCalendarPointer(r: QueueTwinRow): boolean {
  return r.source === "luma" && Boolean(r.externalId?.startsWith("calev-"));
}

/* Same named venue (not just a city), or map pins within 250 m. */
function venueEvidence(a: QueueTwinRow, b: QueueTwinRow): boolean {
  const va = venueName(a.venueName);
  if (va && !PLACEHOLDER_VENUE_RE.test(va) && !coarseVenue(a) && !coarseVenue(b) && va === venueName(b.venueName)) return true;
  if (!hasPin(a) || !hasPin(b)) return false;
  const strip = (r: QueueTwinRow): TwinRow => ({ ...r, link: null, externalId: null, venueName: null });
  return sameEventEvidence(strip(a), strip(b));
}

function rank(r: QueueTwinRow, now: Date): number[] {
  /* Lower sorts first = kept. */
  const fresh = r.source === "manual" || now.getTime() - r.updatedAt.getTime() < STALE_AFTER_MS;
  return [r.statusLocked ? 0 : 1, NOT_COMMUNITY_RE.test(r.title) ? 1 : 0, fresh ? 0 : 1, r.createdAt.getTime()];
}

function compare(a: QueueTwinRow, b: QueueTwinRow, now: Date): number {
  const ra = rank(a, now);
  const rb = rank(b, now);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const hideable = (r: QueueTwinRow) => r.status === "pending" && !r.statusLocked && r.source !== "manual";

/* Plan the hides over upcoming pending + approved rows. Approved rows are
   only ever kept (the approved-vs-approved sweep is same-day-twins.ts). */
export function planQueueTwinHides(rows: QueueTwinRow[], now: Date): QueueTwinHide[] {
  const byDay = new Map<string, QueueTwinRow[]>();
  for (const r of rows) {
    if (r.status !== "pending" && r.status !== "approved") continue;
    const k = mtDayKey(r.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const out: QueueTwinHide[] = [];
  for (const day of byDay.values()) {
    const twin = (a: QueueTwinRow, b: QueueTwinRow): TitleMatch | null => {
      const m = matchTitles(a.title, b.title);
      return m && queueTwinEvidence(a, b, m) ? m : null;
    };
    const hidden = new Set<string>();
    /* 1. A pending row with an approved twin goes. */
    const approved = day.filter((r) => r.status === "approved").sort((a, b) => compare(a, b, now));
    for (const p of day.filter(hideable)) {
      for (const a of approved) {
        const m = twin(a, p);
        if (m) {
          out.push({ hide: p, keep: a, match: m });
          hidden.add(p.id);
          break;
        }
      }
    }
    /* 2. Pending twins: keep the best, drop rows twinned with it, repeat. */
    let rest = day
      .filter((r) => r.status === "pending" && !hidden.has(r.id))
      .sort((a, b) => compare(a, b, now));
    while (rest.length >= 2) {
      const [keep, ...others] = rest;
      const drop: QueueTwinHide[] = [];
      for (const r of others) {
        const m = hideable(r) ? twin(keep, r) : null;
        if (m) drop.push({ hide: r, keep, match: m });
      }
      out.push(...drop);
      rest = others.filter((r) => !drop.some((d) => d.hide.id === r.id));
    }
  }
  return out;
}
