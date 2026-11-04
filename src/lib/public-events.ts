/* The public dataset and the in-memory filters every public route uses.
   Pure: no next/* and no database import, so tests load it directly.
   lib/public-data.ts loads and caches the dataset; lib/queries.ts is the
   API the routes call.

   The dataset is every approved event plus all groups. "Upcoming" is
   decided here, against the `now` each caller passes in at render, never
   inside the cached query, so a cached dataset stays correct as time
   passes. */

import { gzipSync, gunzipSync } from "node:zlib";
import type { Event, Group } from "./db/schema";
import { canonicalizeTags, tagQueryVariants } from "./auto-tag";
import type { FilterState } from "./filters";
import { categorizeRegion, type UtahRegion } from "./regions";
import { extractIdPrefix, looksLikeUuid, toSlug } from "./slugs";
import { SPECIAL_WEEK_SLUGS, specialWeekTagsFor } from "./special-weeks";

export const PUBLIC_DATA_TAG = "public-data";
/* Bump whenever the field lists or the payload shape change, so a
   deploy never decodes an entry written by older code. */
export const PUBLIC_PAYLOAD_VERSION = 2;

/* Display columns only. Classifier output, lock flags, hidden reasons
   and scrape ids stay out of the public cache. */
export const PUBLIC_EVENT_FIELDS = [
  "id",
  "title",
  "description",
  "link",
  "source",
  "startsAt",
  "endsAt",
  "timezone",
  "isOnline",
  "venueName",
  "address",
  "city",
  "state",
  "postalCode",
  "latitude",
  "longitude",
  "imageUrl",
  "tags",
  "groupId",
  "status",
  "isConference",
  "isPaid",
  "isTentative",
  "createdAt",
  "updatedAt",
] as const;

export const PUBLIC_GROUP_FIELDS = [
  "id",
  "name",
  "slug",
  "description",
  "source",
  "website",
  "imageUrl",
  "status",
] as const;

export type PublicEventRow = Pick<Event, (typeof PUBLIC_EVENT_FIELDS)[number]>;
export type PublicGroup = Pick<Group, (typeof PUBLIC_GROUP_FIELDS)[number]>;

export interface EventWithGroup extends PublicEventRow {
  group: PublicGroup | null;
  region: UtahRegion;
}

export interface PublicDataInput {
  events: PublicEventRow[];
  groups: PublicGroup[];
  enabledSourceCount: number;
}

/* What the data cache stores. All strings and numbers, so a cache hit
   (JSON round trip) and a miss decode the same way. gz is base64 gzip
   of the JSON body: the raw JSON would pass the 2 MB data cache limit,
   past which Next silently stops caching. */
export interface PublicPayload {
  v: number;
  generatedAt: string;
  count: number;
  gz: string;
  /* What encodePublicPayload cut to stay under PUBLIC_DATA_MAX_BYTES.
     All zero in normal operation. */
  reduced: PayloadReductions;
}

export interface PayloadReductions {
  /* Events or groups with a field cut to its FIELD_CAPS length. */
  capped: number;
  /* Past events whose description was dropped, oldest first. */
  pastDescriptions: number;
  /* Past events left out entirely, oldest first (the archive loses its
     tail). */
  pastEvents: number;
  /* Upcoming events whose description was dropped, furthest out first.
     The last step before giving up. */
  upcomingDescriptions: number;
}

export const NO_REDUCTIONS: PayloadReductions = {
  capped: 0,
  pastDescriptions: 0,
  pastEvents: 0,
  upcomingDescriptions: 0,
};

/* Anything beyond capping a runaway field or dropping old descriptions
   changes what visitors see, so the health alert treats it as urgent. */
export function isSeverelyReduced(r: PayloadReductions): boolean {
  return r.pastEvents > 0 || r.upcomingDescriptions > 0;
}

export function isReduced(r: PayloadReductions): boolean {
  return r.capped > 0 || r.pastDescriptions > 0 || isSeverelyReduced(r);
}

/* Next's data cache skips (with one log line) any entry over 2 MB,
   measured as the JSON length of the entry. Past that every page view
   would refill, which keeps the database awake. Warn well before it, and
   never return an entry above PUBLIC_DATA_MAX_BYTES: encodePublicPayload
   throws instead, so the refill fails, the stale entry keeps being
   served and the refill backoff applies (lib/refill-guard.ts). */
export const PUBLIC_DATA_LIMIT_BYTES = 2 * 1024 * 1024;
export const PUBLIC_DATA_WARN_BYTES = 1.5 * 1024 * 1024;
export const PUBLIC_DATA_MAX_BYTES = 1.8 * 1024 * 1024;

/* Wait before retrying a failed refill (lib/refill-guard.ts). None after
   the first failure in a row, so the next read tries once more; then
   30 s, doubling, at most 15 min. A database that keeps failing gets one
   extra refill per instance, then the same backoff as before.

   Why the first retry is free: the refill that fails may be one that
   read the database before a write. If it started a backoff, the reads
   after the writer's delayed mark would get the stale (pre-write) entry
   without a refill, and an ISR page built from it then would be stored
   as fresh. See lib/public-data-timing.ts. */
export function nextBackoffMs(failureCount: number): number {
  if (failureCount <= 1) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (failureCount - 2));
}

/* A failure this long after the previous one starts a new streak (counts
   as the first, so no backoff). Longer than the 15 min maximum wait, so a
   database that keeps failing still escalates: its failures come at each
   retry time. Without it, a guard copy that failed once and then sat idle
   while other copies or instances refilled the shared entry would keep
   that count for hours, and its next failure, perhaps a refill that read
   before a write, would start a backoff right away. */
export const FAILURE_STREAK_WINDOW_MS = 20 * 60_000;

/* Size as the data cache measures it (close enough: the entry wraps the
   payload with a few short fields). */
export function payloadStoredBytes(p: PublicPayload): number {
  return JSON.stringify(p).length;
}

export interface PublicData {
  generatedAt: Date;
  events: EventWithGroup[];
  groups: PublicGroup[];
  enabledSourceCount: number;
}

export class PublicDataTooLargeError extends Error {
  constructor(
    readonly bytes: number,
    readonly maxBytes: number,
    readonly reduced: PayloadReductions,
  ) {
    super(
      `public-data payload is ${bytes} bytes after every reduction (max ${maxBytes}): ` +
        `${JSON.stringify(reduced)}. The upcoming events alone no longer fit one cache entry.`,
    );
    this.name = "PublicDataTooLargeError";
  }
}

/* Longest value kept per field, in UTF-16 units. Far above real data
   (the longest description today is about 3,300 characters), so they only
   bite on a runaway row, such as a scraper storing a whole page as a
   description. They bound every row's size; ids and dates are fixed
   size. A URL over its cap is dropped rather than cut, since a cut URL
   is a broken link. */
export const FIELD_CAPS = {
  title: 500,
  description: 10_000,
  venueName: 300,
  address: 500,
  city: 120,
  state: 64,
  postalCode: 32,
  timezone: 64,
  source: 64,
  status: 32,
  url: 2048,
  tags: 32,
  tag: 64,
  groupName: 300,
  groupSlug: 200,
  groupDescription: 4000,
} as const;

function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  /* Never end on half of a surrogate pair. */
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}
const cutOrNull = (s: string | null, max: number) => (s === null ? null : cut(s, max));
const urlOrNull = (s: string | null) => (s !== null && s.length > FIELD_CAPS.url ? null : s);
/* Numeric columns arrive as short strings; anything else is junk. */
const coordOrNull = (s: string | null) => (s !== null && s.length > 32 ? null : s);

function capEvent(e: PublicEventRow): PublicEventRow {
  const tags =
    e.tags === null
      ? null
      : e.tags.filter((t) => t.length <= FIELD_CAPS.tag).slice(0, FIELD_CAPS.tags);
  const out: PublicEventRow = {
    ...e,
    title: cut(e.title, FIELD_CAPS.title),
    description: cutOrNull(e.description, FIELD_CAPS.description),
    link: urlOrNull(e.link),
    source: cut(e.source, FIELD_CAPS.source),
    timezone: cut(e.timezone, FIELD_CAPS.timezone),
    venueName: cutOrNull(e.venueName, FIELD_CAPS.venueName),
    address: cutOrNull(e.address, FIELD_CAPS.address),
    city: cutOrNull(e.city, FIELD_CAPS.city),
    state: cutOrNull(e.state, FIELD_CAPS.state),
    postalCode: cutOrNull(e.postalCode, FIELD_CAPS.postalCode),
    latitude: coordOrNull(e.latitude),
    longitude: coordOrNull(e.longitude),
    imageUrl: urlOrNull(e.imageUrl),
    tags,
    status: cut(e.status, FIELD_CAPS.status),
  };
  return sameFields(e, out) && (e.tags === null || e.tags.length === tags?.length) ? e : out;
}

function capGroup(g: PublicGroup): PublicGroup {
  const out: PublicGroup = {
    ...g,
    name: cut(g.name, FIELD_CAPS.groupName),
    slug: cut(g.slug, FIELD_CAPS.groupSlug),
    description: cutOrNull(g.description, FIELD_CAPS.groupDescription),
    source: cutOrNull(g.source, FIELD_CAPS.source),
    website: urlOrNull(g.website),
    imageUrl: urlOrNull(g.imageUrl),
    status: cut(g.status, FIELD_CAPS.status),
  };
  return sameFields(g, out) ? g : out;
}

function sameFields<T extends object>(a: T, b: T): boolean {
  for (const k of Object.keys(b) as Array<keyof T>) {
    if (k === "tags") continue;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function encodeOnce(
  input: PublicDataInput,
  generatedAt: Date,
  reduced: PayloadReductions,
): PublicPayload {
  const body = JSON.stringify({
    events: input.events,
    groups: input.groups,
    enabledSourceCount: input.enabledSourceCount,
  });
  return {
    v: PUBLIC_PAYLOAD_VERSION,
    generatedAt: generatedAt.toISOString(),
    count: input.events.length,
    gz: gzipSync(body).toString("base64"),
    reduced: { ...reduced },
  };
}

const byStartThenId = (a: PublicEventRow, b: PublicEventRow) =>
  a.startsAt.getTime() - b.startsAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* Encodes the dataset so the stored entry is at most maxBytes, or
   throws PublicDataTooLargeError.

   Every row is first held to FIELD_CAPS, so no single row can be huge.
   If the entry is still too big, these steps run in order, each in
   chunks of a tenth of its rows and only as far as needed:
   1. drop descriptions of past events, oldest first;
   2. leave out past events entirely, oldest first;
   3. drop descriptions of upcoming events, furthest out first.
   Upcoming events and groups are never left out. If all three are not
   enough, it throws: the refill fails, the stale entry keeps being
   served, the refill backs off, and the logs and health alert say so.
   "Past" is relative to generatedAt, the same `now` a refill uses.

   The chunks make at most 30 cut points, each cutting more than the one
   before; it returns the first that fits. Every try is a full JSON
   encode and gzip, a few hundred ms of synchronous CPU on a large
   dataset, which blocks the instance and counts toward the refill time
   limit. Trying the cut points in order took up to 31 tries. Instead,
   it predicts the first cut point that fits from the length of the text
   each one removes and the compression ratio of a small sample, tries
   that one and its neighbour, then bisects what is left. Usually 3
   tries, never more than MAX_ENCODE_PASSES. The prediction only picks
   what to try: every returned entry was measured. */
export const MAX_ENCODE_PASSES = 8;

export function encodePublicPayload(
  input: PublicDataInput,
  generatedAt: Date,
  maxBytes: number = PUBLIC_DATA_MAX_BYTES,
  stats?: { passes: number },
): PublicPayload {
  const capped: PayloadReductions = { ...NO_REDUCTIONS };
  const events = input.events.map((e) => {
    const c = capEvent(e);
    if (c !== e) capped.capped++;
    return c;
  });
  const groups = input.groups.map((g) => {
    const c = capGroup(g);
    if (c !== g) capped.capped++;
    return c;
  });
  const encode = (rows: PublicEventRow[], reduced: PayloadReductions) => {
    if (stats) stats.passes++;
    return encodeOnce({ events: rows, groups, enabledSourceCount: input.enabledSourceCount }, generatedAt, reduced);
  };
  const fits = (p: PublicPayload) => payloadStoredBytes(p) <= maxBytes;

  const whole = encode(events, capped);
  if (fits(whole)) return whole;

  const now = generatedAt.getTime();
  const pastOldestFirst = events.filter((e) => e.startsAt.getTime() < now).sort(byStartThenId);
  const upcomingFurthestFirst = events
    .filter((e) => e.startsAt.getTime() >= now)
    .sort((a, b) => byStartThenId(b, a));
  const pastStep = Math.max(1, Math.ceil(pastOldestFirst.length / 10));
  const upcomingStep = Math.max(1, Math.ceil(upcomingFurthestFirst.length / 10));
  const pastChunks = Math.ceil(pastOldestFirst.length / pastStep);
  const upcomingChunks = Math.ceil(upcomingFurthestFirst.length / upcomingStep);
  /* Cut points 1..last: past descriptions, then past events, then
     upcoming descriptions, a chunk at a time. Cut point k drops the
     first n rows of each list. */
  const last = 2 * pastChunks + upcomingChunks;
  const cutAt = (k: number) => ({
    pastDescriptions: Math.min(k, pastChunks) * pastStep,
    pastEvents: Math.min(Math.max(k - pastChunks, 0), pastChunks) * pastStep,
    upcomingDescriptions: Math.max(k - 2 * pastChunks, 0) * upcomingStep,
  });

  /* The dataset at cut point k, built from the input each time so cut
     points can be tried in any order. */
  const at = (k: number): PublicPayload => {
    const n = cutAt(k);
    const reduced: PayloadReductions = { ...capped };
    const noDescription = new Set<string>();
    for (const e of pastOldestFirst.slice(0, n.pastDescriptions)) {
      noDescription.add(e.id);
      if (e.description !== null) reduced.pastDescriptions++;
    }
    const leftOut = new Set(pastOldestFirst.slice(0, n.pastEvents).map((e) => e.id));
    reduced.pastEvents = leftOut.size;
    for (const e of upcomingFurthestFirst.slice(0, n.upcomingDescriptions)) {
      noDescription.add(e.id);
      if (e.description !== null) reduced.upcomingDescriptions++;
    }
    const rows: PublicEventRow[] = [];
    for (const e of events) {
      if (leftOut.has(e.id)) continue;
      rows.push(noDescription.has(e.id) && e.description !== null ? { ...e, description: null } : e);
    }
    return encode(rows, reduced);
  };

  /* Predicted stored size at cut point k: the uncut entry's size, less
     what the cut text would take compressed. Descriptions and the rest
     of a row compress differently, so each gets its own ratio, measured
     by gzipping an evenly spread sample of about 256 KB. */
  const descLen = (e: PublicEventRow) => e.description?.length ?? 0;
  const restJson = (e: PublicEventRow) => JSON.stringify({ ...e, description: null });
  const prefix = (rows: PublicEventRow[], len: (e: PublicEventRow) => number) => {
    const sums = [0];
    for (const e of rows) sums.push(sums[sums.length - 1] + len(e));
    return (n: number) => sums[Math.min(n, rows.length)];
  };
  const sampleRatio = (texts: (e: PublicEventRow) => string) => {
    const total = events.reduce((sum, e) => sum + texts(e).length, 0);
    const every = Math.max(1, Math.ceil(total / (256 * 1024)));
    const sample = events.filter((_, i) => i % every === 0).map(texts).join("");
    return sample.length === 0 ? 0 : (gzipSync(sample).length * 4) / 3 / sample.length;
  };
  const descRatio = sampleRatio((e) => e.description ?? "");
  const restRatio = sampleRatio(restJson);
  const pastDesc = prefix(pastOldestFirst, descLen);
  const pastRest = prefix(pastOldestFirst, (e) => restJson(e).length + 1);
  const upcomingDesc = prefix(upcomingFurthestFirst, descLen);
  const wholeBytes = payloadStoredBytes(whole);
  const predicted = (k: number) => {
    const n = cutAt(k);
    const desc = pastDesc(n.pastDescriptions) + upcomingDesc(n.upcomingDescriptions);
    return wholeBytes - desc * descRatio - pastRest(n.pastEvents) * restRatio;
  };
  let guess = 1;
  while (guess < last && predicted(guess) > maxBytes) guess++;

  /* Search [lo, hi): every cut point below lo is known not to fit, hi is
     the smallest known to fit (last + 1 while none is known). The first
     try is the prediction, the second its neighbour, then bisection. */
  let lo = 1;
  let hi = last + 1;
  let best: PublicPayload | null = null;
  let tightest = whole;
  let k = guess;
  for (let tries = 1; lo < hi; tries++) {
    const p = at(k);
    const fit = fits(p);
    if (fit) {
      hi = k;
      best = p;
    } else {
      lo = k + 1;
      tightest = p;
    }
    const neighbour = fit ? k - 1 : k + 1;
    k = tries === 1 && neighbour >= lo && neighbour < hi ? neighbour : Math.floor((lo + hi) / 2);
  }
  if (best === null) {
    throw new PublicDataTooLargeError(payloadStoredBytes(tightest), maxBytes, { ...tightest.reduced });
  }
  return best;
}

type WireEvent = Omit<PublicEventRow, "startsAt" | "endsAt" | "createdAt" | "updatedAt"> & {
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function compareByStart(a: { startsAt: Date; id: string }, b: { startsAt: Date; id: string }): number {
  const d = a.startsAt.getTime() - b.startsAt.getTime();
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/* Decoding is the same for every request until the next refill, so the
   last result is kept per instance. Callers never mutate it. */
let lastDecoded: { key: string; data: PublicData } | null = null;

export function decodePublicPayload(p: PublicPayload): PublicData {
  if (p.v !== PUBLIC_PAYLOAD_VERSION) {
    throw new Error(`public-data payload version ${p.v}, expected ${PUBLIC_PAYLOAD_VERSION}`);
  }
  const key = `${p.generatedAt}|${p.count}|${p.gz.length}`;
  if (lastDecoded?.key === key) return lastDecoded.data;

  const body = JSON.parse(gunzipSync(Buffer.from(p.gz, "base64")).toString("utf8")) as {
    events: WireEvent[];
    groups: PublicGroup[];
    enabledSourceCount: number;
  };
  const groupsById = new Map(body.groups.map((g) => [g.id, g]));
  const events: EventWithGroup[] = body.events.map((w) => ({
    ...w,
    startsAt: new Date(w.startsAt),
    endsAt: w.endsAt ? new Date(w.endsAt) : null,
    createdAt: new Date(w.createdAt),
    updatedAt: new Date(w.updatedAt),
    group: (w.groupId && groupsById.get(w.groupId)) || null,
    region: categorizeRegion({ city: w.city, venueName: w.venueName, address: w.address }),
  }));
  events.sort(compareByStart);

  const data: PublicData = {
    generatedAt: new Date(p.generatedAt),
    events,
    groups: body.groups,
    enabledSourceCount: body.enabledSourceCount,
  };
  lastDecoded = { key, data };
  return data;
}

/* ---- filters ------------------------------------------------------ */

export function isUpcoming(e: { startsAt: Date }, now: Date): boolean {
  return e.startsAt.getTime() >= now.getTime();
}

/* The ?filters predicate shared by the homepage, embed, feeds, digest and
   /api/feed/count, so a count always equals what a feed delivers. */
function eventPredicate(f: FilterState, now: Date): (e: EventWithGroup) => boolean {
  const from = f.from ? new Date(f.from) : now;
  let to: Date | null = null;
  if (f.to) {
    to = new Date(f.to);
    to.setHours(23, 59, 59, 999);
  }
  const q = f.q ? f.q.toLowerCase() : "";
  const knownCities = f.cities.filter((c) => c !== "Unknown");
  const wantsUnknownCity = f.cities.includes("Unknown");
  /* Old tag spellings too (`startup` for founders), exact case like the
     old SQL array overlap, plus a special week matched by title and date
     (lib/special-weeks.ts) for rows that never got the tag. */
  const tagVariants = new Set(f.tags.flatMap(tagQueryVariants));
  const weekTags = f.tags.filter((t) => SPECIAL_WEEK_SLUGS.has(t));

  return (e) => {
    const start = e.startsAt.getTime();
    if (!(start >= from.getTime())) return false;
    if (to && !(start <= to.getTime())) return false;
    if (!f.showOnline && e.isOnline) return false;
    if (q) {
      const hit = [e.title, e.description, e.venueName, e.address].some(
        (s) => s != null && s.toLowerCase().includes(q),
      );
      if (!hit) return false;
    }
    if (f.cities.length) {
      const cityHit =
        (e.city !== null && knownCities.includes(e.city)) || (wantsUnknownCity && e.city === null);
      if (!cityHit) return false;
    }
    if (f.groups.length && !(e.group && f.groups.includes(e.group.slug))) return false;
    if (f.tags.length) {
      const tagHit =
        (e.tags ?? []).some((t) => tagVariants.has(t)) ||
        (weekTags.length > 0 && specialWeekTagsFor(e).some((w) => weekTags.includes(w)));
      if (!tagHit) return false;
    }
    if (f.sources.length && !f.sources.includes(e.source)) return false;
    /* OR within the type chip, AND with everything else. Free is
       "not paid", so it includes every unflagged event. */
    if (f.types.length) {
      const typeHit = f.types.some((t) =>
        t === "conference" ? e.isConference : t === "paid" ? e.isPaid : t === "free" ? !e.isPaid : e.isTentative,
      );
      if (!typeHit) return false;
    }
    if (f.regions.length && !f.regions.includes(e.region)) return false;
    return true;
  };
}

export function filterPublicEvents(
  data: PublicData,
  f: FilterState,
  opts: { now: Date; limit: number },
): EventWithGroup[] {
  const match = eventPredicate(f, opts.now);
  const out: EventWithGroup[] = [];
  for (const e of data.events) {
    if (out.length >= opts.limit) break;
    if (match(e)) out.push(e);
  }
  return out;
}

export function countPublicEvents(data: PublicData, f: FilterState, now: Date): number {
  const match = eventPredicate(f, now);
  let n = 0;
  for (const e of data.events) if (match(e)) n++;
  return n;
}

const upcomingInPerson = (data: PublicData, now: Date) =>
  data.events.filter((e) => !e.isOnline && isUpcoming(e, now));

/* RSS "what's new": newest rows first, upcoming and in person. */
export function recentlyAdded(data: PublicData, now: Date, limit = 50): EventWithGroup[] {
  return upcomingInPerson(data, now)
    .sort((a, b) => {
      const d = b.createdAt.getTime() - a.createdAt.getTime();
      if (d !== 0) return d;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, limit);
}

/* /event/<slug-abcd1234> or a legacy /event/<uuid>. Only approved events
   are in the dataset, so hidden and pending ones resolve to null. */
export function findEventByParam(data: PublicData, param: string): EventWithGroup | null {
  const p = param.toLowerCase();
  if (looksLikeUuid(p)) return data.events.find((e) => e.id === p) ?? null;
  const prefix = extractIdPrefix(p);
  if (!prefix) return null;
  return data.events.find((e) => e.id.startsWith(prefix)) ?? null;
}

export function groupBySlug(data: PublicData, slug: string): PublicGroup | null {
  return data.groups.find((g) => g.slug === slug) ?? null;
}

/* A group's upcoming events, online included. */
export function groupUpcoming(data: PublicData, groupId: string, now: Date, limit = 50): EventWithGroup[] {
  return data.events.filter((e) => e.groupId === groupId && isUpcoming(e, now)).slice(0, limit);
}

/* The stored city string behind a /city/<slug>. */
export function cityFromSlug(data: PublicData, slug: string): string | null {
  for (const e of data.events) {
    if (e.city && e.city.trim() && toSlug(e.city) === slug) return e.city;
  }
  return null;
}

export function cityEvents(data: PublicData, city: string, now: Date): EventWithGroup[] {
  return data.events.filter((e) => !e.isOnline && e.city === city && isUpcoming(e, now));
}

/* A tag that is not curated resolves when an upcoming event (online
   included) carries it. */
export function tagFromUpcomingSlug(data: PublicData, slug: string, now: Date): string | null {
  for (const e of data.events) {
    if (!isUpcoming(e, now)) continue;
    for (const t of e.tags ?? []) {
      const lower = t.toLowerCase();
      if (toSlug(lower) === slug) return lower;
    }
  }
  return null;
}

/* What /tag/<tag> and /startup-events list: upcoming, in person, any
   case of the tag or an old spelling, or a special week by title. */
export function tagEvents(data: PublicData, tag: string, now: Date): EventWithGroup[] {
  const variants = tagQueryVariants(tag.toLowerCase());
  const isWeek = SPECIAL_WEEK_SLUGS.has(tag);
  return data.events.filter(
    (e) =>
      !e.isOnline &&
      isUpcoming(e, now) &&
      ((e.tags ?? []).some((t) => variants.includes(t.toLowerCase())) ||
        (isWeek && specialWeekTagsFor(e).includes(tag))),
  );
}

/* from <= startsAt < to, online included (the /events/<month> pages). */
export function eventsInRange(data: PublicData, from: Date, to: Date): EventWithGroup[] {
  const a = from.getTime();
  const b = to.getTime();
  return data.events.filter((e) => {
    const t = e.startsAt.getTime();
    return t >= a && t < b;
  });
}

const byCountThen = <T extends { count: number }>(key: (x: T) => string) => (a: T, b: T) =>
  b.count - a.count || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

/* Filter chip counts: upcoming, in person. A null city counts as
   "Unknown" (the picker's Location TBD); empty strings are dropped. */
export function cityCounts(data: PublicData, now: Date): Array<{ city: string; count: number }> {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const e of upcomingInPerson(data, now)) {
    if (e.city === null) unknown++;
    else if (e.city) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
  }
  const out = Array.from(counts, ([city, count]) => ({ city, count }));
  if (unknown > 0) out.push({ city: "Unknown", count: unknown });
  return out.sort(byCountThen((r) => r.city));
}

/* Counted under canonical names, once per event, so the chips match
   what ?tags= returns. */
export function tagCounts(data: PublicData, now: Date): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of upcomingInPerson(data, now)) {
    for (const t of canonicalizeTags(e.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(byCountThen((r) => r.tag));
}

export function sourceCounts(data: PublicData, now: Date): Array<{ source: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of upcomingInPerson(data, now)) {
    if (e.source) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  }
  return Array.from(counts, ([source, count]) => ({ source, count })).sort(byCountThen((r) => r.source));
}

export function groupCounts(
  data: PublicData,
  now: Date,
): Array<{ slug: string; name: string; count: number }> {
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const e of upcomingInPerson(data, now)) {
    if (!e.group?.slug) continue;
    const row = counts.get(e.group.slug) ?? { slug: e.group.slug, name: e.group.name, count: 0 };
    row.count++;
    counts.set(e.group.slug, row);
  }
  return Array.from(counts.values()).sort(byCountThen((r) => r.slug));
}

/* ---- sitemap ------------------------------------------------------ */

export interface SitemapInputs {
  upcoming: Array<{ id: string; title: string; updatedAt: Date }>;
  cityRows: Array<{ city: string; n: number }>;
  tagRows: Array<{ tags: string[] | null; title: string; startsAt: Date }>;
  monthRows: Array<{ y: number; m: number; n: number }>;
  groupRows: Array<{ slug: string }>;
}

/* The rows sitemap.ts builds its URL list from, each counted the way
   the matching page counts. */
export function sitemapInputs(data: PublicData, now: Date): SitemapInputs {
  const upcoming = data.events
    .filter((e) => isUpcoming(e, now))
    .slice(0, 2000)
    .map((e) => ({ id: e.id, title: e.title, updatedAt: e.updatedAt }));

  const inPerson = upcomingInPerson(data, now);
  const cityMap = new Map<string, number>();
  for (const e of inPerson) {
    if (e.city && e.city.trim()) cityMap.set(e.city, (cityMap.get(e.city) ?? 0) + 1);
  }
  const cityRows = Array.from(cityMap, ([city, n]) => ({ city, n }));

  const tagRows = inPerson
    .slice(0, 5000)
    .map((e) => ({ tags: e.tags, title: e.title, startsAt: e.startsAt }));

  /* /events/<month>: UTC months (lib/period.ts), last 12 through next 12. */
  const lo = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1);
  const hi = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1);
  const monthMap = new Map<string, { y: number; m: number; n: number }>();
  for (const e of data.events) {
    const t = e.startsAt.getTime();
    if (t < lo || t >= hi) continue;
    const y = e.startsAt.getUTCFullYear();
    const m = e.startsAt.getUTCMonth() + 1;
    const k = `${y}-${m}`;
    const row = monthMap.get(k) ?? { y, m, n: 0 };
    row.n++;
    monthMap.set(k, row);
  }
  const monthRows = Array.from(monthMap.values()).sort((a, b) => a.y - b.y || a.m - b.m);

  const groupRows = data.groups.filter((g) => g.status === "active").map((g) => ({ slug: g.slug }));

  return { upcoming, cityRows, tagRows, monthRows, groupRows };
}
