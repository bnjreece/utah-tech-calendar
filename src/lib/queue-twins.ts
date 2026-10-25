import { normalizeLink, STALE_AFTER_MS, type TwinRow } from "./same-day-twins";
import { mtDayKey } from "./time";

/* Queue twins: duplicates sitting in the PENDING review queue. The autopilot
   checks for a duplicate only once, when a row is first classified, so a
   twin that arrives later (an organizer renames an Eventbrite listing and
   the new slug is scraped as a new row) waits for a human. The dedup sweep runs this after every scrape.

   Only one kind of evidence counts: the SAME LISTING. Same source, and
   both links name the same upstream listing id: an Eventbrite event id
   (/e/<slug>-tickets-<id> or /e/<id>; a renamed slug keeps the id), a
   Meetup event id (/<group>/events/<id>) or a Luma event slug (lu.ma/<slug>,
   counted only on Luma rows with an event id, evt-..., since a lu.ma path
   can also be a calendar, and never on a Luma calendar's external listing,
   calev-..., which only points elsewhere). Any other link (an organizer
   homepage, a recurrence source's one shared URL) is never identity.
   Titles may differ. There is no title, venue or place matching: two
   listings with different ids are two events as far as this rule knows
   (a missed duplicate is a nuisance, a hidden event is a loss), and a
   human decides them.

   Both rows start on the same Denver day. Which row stays: a pending row
   with an approved twin is hidden (the approved row is already public).
   Among pending twins the kept row is a locked one, then the more recently
   refreshed one, then the oldest (created_at, id). Freshness only ranks two
   rows already known to be one listing, never decides a match: updated_at
   is refreshed by every re-scrape (lib/scrape-runner.ts) but also by admin
   actions, so it is not proof of anything on its own. A row not refreshed
   for STALE_AFTER_MS (2 days) ranks behind one that was; manual rows always
   rank as refreshed. Locked and manual rows are never hidden. Pure: the
   sweep loads rows and applies the result. */

export interface QueueTwinRow extends TwinRow {
  status: string;
}

export interface QueueTwinHide {
  hide: QueueTwinRow;
  keep: QueueTwinRow;
}

/* The upstream listing a link names, or null when the link is not a known
   per-event listing URL. */
export function listingKey(link: string | null | undefined): string | null {
  const n = normalizeLink(link);
  if (!n) return null;
  const path = n.split("?")[0];
  const eb = /^eventbrite\.[a-z.]+\/e\/(?:[^/]*-)?(\d{9,})$/.exec(path);
  if (eb) return `eventbrite:${eb[1]}`;
  const mu = /^meetup\.com\/[^/]+\/events\/([a-z0-9]+)$/.exec(path);
  if (mu) return `meetup:${mu[1]}`;
  const lu = /^lu\.ma\/([a-z0-9][a-z0-9-]*)$/.exec(path);
  if (lu) return `luma:${lu[1]}`;
  return null;
}

/* Refreshed recently (keeper ranking only, see the header). */
function recent(r: QueueTwinRow, now: Date): boolean {
  return r.source === "manual" || now.getTime() - r.updatedAt.getTime() < STALE_AFTER_MS;
}

/* A lu.ma link names one event only on a Luma event row (evt-...). */
const lumaEvent = (r: QueueTwinRow) => r.source === "luma" && Boolean(r.externalId?.startsWith("evt-"));

/* Same source, same upstream listing id. */
export function sameListing(a: QueueTwinRow, b: QueueTwinRow): boolean {
  if (a.source !== b.source) return false;
  const ka = listingKey(a.link);
  if (ka === null || ka !== listingKey(b.link)) return false;
  return !ka.startsWith("luma:") || (lumaEvent(a) && lumaEvent(b));
}

/* `hide` and `keep` are one listing on the same Denver day. */
export function isQueueTwin(hide: QueueTwinRow, keep: QueueTwinRow): boolean {
  return hide.id !== keep.id && mtDayKey(hide.startsAt) === mtDayKey(keep.startsAt) && sameListing(hide, keep);
}

/* Lower sorts first = kept. */
function rank(r: QueueTwinRow, now: Date): number[] {
  return [r.statusLocked ? 0 : 1, recent(r, now) ? 0 : 1, r.createdAt.getTime()];
}

/* Ties on created_at break on id, matching (created_at, id) in SQL. */
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
    const hidden = new Set<string>();
    /* 1. A pending row with an approved twin goes. */
    const approved = day.filter((r) => r.status === "approved").sort((a, b) => compare(a, b, now));
    for (const p of day.filter(hideable)) {
      for (const a of approved) {
        if (isQueueTwin(p, a)) {
          out.push({ hide: p, keep: a });
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
        if (hideable(r) && isQueueTwin(r, keep)) drop.push({ hide: r, keep });
      }
      out.push(...drop);
      rest = others.filter((r) => !drop.some((d) => d.hide.id === r.id));
    }
  }
  return out;
}
