import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cityCounts,
  cityEvents,
  cityFromSlug,
  countPublicEvents,
  decodePublicPayload,
  encodePublicPayload,
  MAX_ENCODE_PASSES,
  eventsInRange,
  filterPublicEvents,
  findEventByParam,
  FIELD_CAPS,
  nextBackoffMs,
  NO_REDUCTIONS,
  payloadStoredBytes,
  PUBLIC_DATA_MAX_BYTES,
  PublicDataTooLargeError,
  groupBySlug,
  groupCounts,
  groupUpcoming,
  recentlyAdded,
  sitemapInputs,
  sourceCounts,
  tagCounts,
  tagEvents,
  tagFromUpcomingSlug,
  type PublicData,
  type PublicDataInput,
  type PublicEventRow,
  type PublicGroup,
} from "../src/lib/public-events";
import { parseFilters, type FilterState } from "../src/lib/filters";
import { eventSlug } from "../src/lib/slugs";
import { detectPublicDataSize, PUBLIC_DATA_MAX_AGE_MS, publicDataUnavailableAlert } from "../src/lib/health";
import { randomBytes } from "node:crypto";

/* All in memory: the dataset the public pages read, and the filters that
   replaced the per-request SQL. No database. */

const NOW = new Date("2026-11-02T18:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);

let seq = 0;
function uuid(prefix: string): string {
  seq++;
  const tail = seq.toString(16).padStart(12, "0");
  return `${prefix}-1111-4222-8333-${tail}`;
}

function row(over: Partial<PublicEventRow> = {}): PublicEventRow {
  return {
    id: uuid("aaaaaaaa"),
    title: "Utah JS Meetup",
    description: "Talks and pizza",
    link: "https://example.com/e",
    source: "meetup",
    startsAt: hours(24),
    endsAt: hours(26),
    timezone: "America/Denver",
    isOnline: false,
    venueName: "Kiln",
    address: "123 Main St",
    city: "Lehi",
    state: "UT",
    postalCode: "84043",
    latitude: "40.391600",
    longitude: "-111.850800",
    imageUrl: null,
    tags: ["javascript"],
    groupId: null,
    status: "approved",
    isConference: false,
    isPaid: false,
    isTentative: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-02T00:00:00Z"),
    ...over,
  };
}

const GROUP_A: PublicGroup = {
  id: "9a000000-1111-4222-8333-000000000001",
  name: "Utah JS",
  slug: "utah-js",
  description: null,
  source: "meetup",
  website: null,
  imageUrl: null,
  status: "active",
};
const GROUP_HIDDEN: PublicGroup = {
  ...GROUP_A,
  id: "9a000000-1111-4222-8333-000000000002",
  name: "Old Group",
  slug: "old-group",
  status: "hidden",
};

/* Encode, JSON round trip (what a data cache hit returns), decode. */
function build(events: PublicEventRow[], groups: PublicGroup[] = [GROUP_A, GROUP_HIDDEN], enabledSourceCount = 7): PublicData {
  const input: PublicDataInput = { events, groups, enabledSourceCount };
  const payload = JSON.parse(JSON.stringify(encodePublicPayload(input, new Date(NOW.getTime() + seq))));
  return decodePublicPayload(payload);
}

function filters(over: Partial<FilterState> = {}): FilterState {
  return { ...parseFilters({}), ...over };
}

const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

/* ---- payload ---- */

test("payload: a cache hit decodes to Dates, attached groups, regions and start order", () => {
  const late = row({ startsAt: hours(48), groupId: GROUP_A.id });
  const early = row({ startsAt: hours(2), city: "Provo" });
  const data = build([late, early]);
  assert.deepEqual(ids(data.events), [early.id, late.id]);
  const e = data.events[1];
  assert.ok(e.startsAt instanceof Date && e.endsAt instanceof Date);
  assert.ok(e.createdAt instanceof Date && e.updatedAt instanceof Date);
  assert.equal(e.startsAt.getTime(), late.startsAt.getTime());
  assert.equal(e.group?.slug, "utah-js");
  assert.equal(data.events[0].group, null);
  assert.equal(e.region, "Utah County");
  assert.equal(data.enabledSourceCount, 7);
  assert.ok(data.generatedAt instanceof Date);
});

test("payload: a miss and a hit decode to the same data", () => {
  const events = [row({ endsAt: null, groupId: GROUP_A.id }), row({ startsAt: hours(5) })];
  const payload = encodePublicPayload({ events, groups: [GROUP_A], enabledSourceCount: 3 }, NOW);
  const miss = decodePublicPayload(payload);
  /* Decode something else in between so the per-instance memo cannot
     hand back the same object. */
  decodePublicPayload(encodePublicPayload({ events: [], groups: [], enabledSourceCount: 0 }, hours(-100)));
  const hit = decodePublicPayload(JSON.parse(JSON.stringify(payload)));
  assert.notEqual(hit, miss);
  assert.deepEqual(hit, miss);
  assert.equal(miss.events.find((e) => e.endsAt === null)?.endsAt, null);
});

test("payload: ties on start time sort by id", () => {
  const b = row({ id: "bbbbbbbb-1111-4222-8333-000000000001" });
  const a = row({ id: "aaaaaaaa-1111-4222-8333-000000000001", startsAt: b.startsAt });
  assert.deepEqual(ids(build([b, a]).events), [a.id, b.id]);
});

test("payload: 1,000 realistic events stay far under the 2 MB data cache limit", () => {
  const events = Array.from({ length: 1000 }, (_, i) =>
    row({
      title: `Event number ${i} about AI, startups and cloud infrastructure`,
      description: `A long description ${i} `.repeat(40),
      startsAt: hours(i),
      tags: ["ai", "founders", "cloud"],
    }),
  );
  const payload = encodePublicPayload({ events, groups: [GROUP_A], enabledSourceCount: 50 }, NOW);
  const bytes = JSON.stringify(payload).length;
  assert.ok(bytes < 1.5 * 1024 * 1024, `payload is ${bytes} bytes`);
});

/* Random text does not compress, so sizes are predictable. A seeded
   generator keeps the property test below reproducible. */
function prng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}
const noise = (n: number) => randomBytes(Math.ceil((n * 3) / 4)).toString("base64").slice(0, n);
const enc = (events: PublicEventRow[], groups: PublicGroup[] = [], maxBytes?: number) =>
  encodePublicPayload({ events, groups, enabledSourceCount: 1 }, NOW, maxBytes);
const upcomingIds = (events: PublicEventRow[]) =>
  events.filter((e) => e.startsAt.getTime() >= NOW.getTime()).map((e) => e.id).sort();

test("payload: under the size cap nothing is cut", () => {
  const payload = enc([row({ description: "kept" })]);
  assert.deepEqual(payload.reduced, NO_REDUCTIONS);
  assert.equal(decodePublicPayload(payload).events[0].description, "kept");
});

test("payload: normal rows pass the field caps untouched; runaway fields are cut or dropped", () => {
  const normal = row({ description: "d".repeat(3335), tags: ["ai", "founders"] });
  const runaway = row({
    title: "t".repeat(5000),
    description: "x".repeat(50_000),
    venueName: "v".repeat(5000),
    address: "a".repeat(5000),
    city: "c".repeat(500),
    link: `https://example.com/${"p".repeat(5000)}`,
    imageUrl: `https://example.com/${"i".repeat(5000)}`,
    tags: ["ok", "y".repeat(500), ...Array.from({ length: 100 }, (_, i) => `t${i}`)],
    latitude: "9".repeat(100),
  });
  const group: PublicGroup = {
    ...GROUP_A,
    id: "9a000000-1111-4222-8333-000000000099",
    slug: "runaway",
    name: "n".repeat(5000),
    description: "g".repeat(100_000),
    website: `https://example.com/${"w".repeat(5000)}`,
  };
  const payload = enc([normal, runaway], [GROUP_A, group]);
  assert.equal(payload.reduced.capped, 2, "the runaway event and the runaway group");
  const data = decodePublicPayload(payload);
  const n = data.events.find((e) => e.id === normal.id)!;
  assert.equal(n.description, normal.description);
  assert.deepEqual(n.tags, normal.tags);
  const r = data.events.find((e) => e.id === runaway.id)!;
  assert.equal(r.title.length, FIELD_CAPS.title);
  assert.equal(r.description?.length, FIELD_CAPS.description);
  assert.equal(r.venueName?.length, FIELD_CAPS.venueName);
  assert.equal(r.address?.length, FIELD_CAPS.address);
  assert.equal(r.city?.length, FIELD_CAPS.city);
  assert.equal(r.link, null, "a cut URL would be a broken link, so it is dropped");
  assert.equal(r.imageUrl, null);
  assert.equal(r.latitude, null);
  assert.equal(r.tags?.length, FIELD_CAPS.tags);
  assert.ok(r.tags?.every((t) => t.length <= FIELD_CAPS.tag));
  const g = data.groups.find((x) => x.id === group.id)!;
  assert.equal(g.name.length, FIELD_CAPS.groupName);
  assert.equal(g.description?.length, FIELD_CAPS.groupDescription);
  assert.equal(g.website, null);
  assert.deepEqual(data.groups.find((x) => x.id === GROUP_A.id), GROUP_A);
});

test("payload: a cut never ends on half a surrogate pair", () => {
  const title = "a".repeat(FIELD_CAPS.title - 1) + "\u{1F600}".repeat(10);
  const t = decodePublicPayload(enc([row({ title })])).events[0].title;
  assert.equal(t.length, FIELD_CAPS.title - 1);
  assert.equal(JSON.stringify(t), JSON.stringify(t.toWellFormed()));
});

test("payload: the oversized entry from the review (big group and event fields) is bounded", () => {
  /* Shaped like the reviewer's 2.28 MB reproduction: huge group fields
     and huge non-description event fields, all incompressible. */
  const groups = Array.from({ length: 4 }, (_, i) => ({
    ...GROUP_A,
    id: `9a000000-1111-4222-8333-00000000010${i}`,
    slug: `g${i}`,
    name: noise(100_000),
    description: noise(300_000),
  }));
  const events = Array.from({ length: 40 }, (_, i) =>
    row({ startsAt: hours(i - 20), title: noise(30_000), venueName: noise(10_000), address: noise(10_000), description: null }),
  );
  const raw = JSON.stringify({ events, groups }).length;
  assert.ok(raw > 2 * 1024 * 1024, `fixture is ${raw} bytes`);
  const payload = enc(events, groups);
  assert.ok(payloadStoredBytes(payload) <= PUBLIC_DATA_MAX_BYTES);
  assert.equal(payload.reduced.capped, events.length + groups.length);
  assert.equal(payload.count, events.length, "the field caps were enough; nothing left out");
});

test("payload: over the cap, past descriptions go first, oldest first, upcoming untouched", () => {
  const events = Array.from({ length: 50 }, (_, i) => row({ startsAt: hours(i - 25), description: noise(4000) }));
  /* Input order is not start order: the steps must sort. */
  const shuffled = [...events.slice(25), ...events.slice(0, 25)];
  const full = payloadStoredBytes(enc(shuffled));
  const cap = Math.floor(full * 0.7);
  const before = JSON.stringify(shuffled);
  const payload = enc(shuffled, [], cap);
  assert.ok(payloadStoredBytes(payload) <= cap, `${payloadStoredBytes(payload)} > ${cap}`);
  assert.equal(JSON.stringify(shuffled), before, "input not mutated");
  const r = payload.reduced;
  assert.ok(r.pastDescriptions > 0 && r.pastDescriptions <= 25);
  assert.equal(r.pastEvents, 0);
  assert.equal(r.upcomingDescriptions, 0);
  const decoded = decodePublicPayload(payload).events;
  assert.equal(decoded.length, 50);
  /* decoded is in start order: the first `pastDescriptions` lost their text. */
  assert.ok(decoded.slice(0, r.pastDescriptions).every((e) => e.description === null));
  assert.ok(decoded.slice(r.pastDescriptions).every((e) => typeof e.description === "string"));
});

test("payload: then the oldest past events are left out, never upcoming ones", () => {
  const past = Array.from({ length: 30 }, (_, i) =>
    row({ startsAt: hours(-1 - i * 24), description: noise(2000), venueName: noise(FIELD_CAPS.venueName), address: noise(FIELD_CAPS.address) }),
  );
  const upcoming = Array.from({ length: 10 }, (_, i) => row({ startsAt: hours(1 + i), description: noise(2000) }));
  const all = [...upcoming, ...past];
  const withoutPastText = payloadStoredBytes(enc([...upcoming, ...past.map((e) => ({ ...e, description: null }))]));
  const cap = Math.floor(withoutPastText * 0.7);
  const payload = enc(all, [], cap);
  assert.ok(payloadStoredBytes(payload) <= cap);
  const r = payload.reduced;
  assert.equal(r.pastDescriptions, 30);
  assert.ok(r.pastEvents > 0 && r.pastEvents < 30);
  assert.equal(r.upcomingDescriptions, 0);
  const decoded = decodePublicPayload(payload).events;
  assert.deepEqual(upcomingIds(decoded), upcomingIds(all));
  assert.ok(decoded.filter((e) => e.startsAt < NOW).every((e) => e.description === null));
  /* The ones left out are the oldest. */
  const kept = new Set(decoded.map((e) => e.id));
  const pastNewestFirst = [...past].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const keptPast = pastNewestFirst.filter((e) => kept.has(e.id)).length;
  assert.ok(pastNewestFirst.slice(0, keptPast).every((e) => kept.has(e.id)));
  assert.equal(keptPast, 30 - r.pastEvents);
});

test("payload: last, upcoming descriptions go, furthest out first", () => {
  const upcoming = Array.from({ length: 20 }, (_, i) => row({ startsAt: hours(1 + i), description: noise(4000) }));
  const past = [row({ startsAt: hours(-5), description: noise(4000) })];
  const cap = Math.floor(payloadStoredBytes(enc(upcoming)) * 0.6);
  const payload = enc([...past, ...upcoming], [], cap);
  assert.ok(payloadStoredBytes(payload) <= cap);
  const r = payload.reduced;
  assert.equal(r.pastEvents, 1);
  assert.ok(r.upcomingDescriptions > 0 && r.upcomingDescriptions < 20);
  const decoded = decodePublicPayload(payload).events;
  assert.equal(decoded.length, 20, "every upcoming event is kept");
  const kept = decoded.length - r.upcomingDescriptions;
  assert.ok(decoded.slice(0, kept).every((e) => typeof e.description === "string"));
  assert.ok(decoded.slice(kept).every((e) => e.description === null));
});

test("payload: when even that is not enough it throws instead of returning an oversized entry", () => {
  const upcoming = Array.from({ length: 30 }, (_, i) =>
    row({ startsAt: hours(1 + i), title: noise(FIELD_CAPS.title), address: noise(FIELD_CAPS.address), description: noise(1000) }),
  );
  const cap = Math.floor(payloadStoredBytes(enc(upcoming.map((e) => ({ ...e, description: null })))) * 0.9);
  assert.throws(
    () => enc(upcoming, [], cap),
    (err: unknown) =>
      err instanceof PublicDataTooLargeError &&
      err.bytes > cap &&
      err.reduced.upcomingDescriptions === 30 &&
      err.reduced.pastEvents === 0,
  );
});

test("payload: cutting takes at most MAX_ENCODE_PASSES encodes, not one per tenth", () => {
  /* Each encode is a full JSON + gzip pass of synchronous CPU. Trying
     the 30 cut points in order took up to 31 passes (5 to 7 s on a
     dataset five times today's). The predicted cut point is usually
     right (3 passes); a bad prediction falls back to bisection. */
  const past = Array.from({ length: 200 }, (_, i) => row({ startsAt: hours(-1 - i), description: noise(1500) }));
  const upcoming = Array.from({ length: 100 }, (_, i) => row({ startsAt: hours(1 + i), description: noise(1500) }));
  /* Neighbouring rows share a description: gzip finds the repeat in the
     entry, but the spread-out sample the prediction uses does not, so
     the prediction is far off. */
  const pairs = [...past, ...upcoming].map((e, i, a) => (i % 2 === 1 ? { ...e, description: a[i - 1].description } : e));
  for (const all of [[...past, ...upcoming], pairs]) {
    checkPasses(all);
  }
});

function checkPasses(all: PublicEventRow[]) {
  const full = payloadStoredBytes(enc(all));
  for (const share of [0.9, 0.6, 0.4, 0.3, 0.2, 0.05]) {
    const stats = { passes: 0 };
    const cap = Math.floor(full * share);
    let r;
    try {
      const payload = encodePublicPayload({ events: all, groups: [], enabledSourceCount: 1 }, NOW, cap, stats);
      assert.ok(payloadStoredBytes(payload) <= cap);
      r = payload.reduced;
    } catch (err) {
      assert.ok(err instanceof PublicDataTooLargeError, String(err));
      r = err.reduced;
    }
    assert.ok(stats.passes <= MAX_ENCODE_PASSES, `share ${share}: ${stats.passes} passes`);
    /* The steps still go in order: no past event left out while a past
       description remains, no upcoming description cut while a past
       event remains. */
    if (r.pastEvents > 0) assert.equal(r.pastDescriptions, 200);
    if (r.upcomingDescriptions > 0) assert.equal(r.pastEvents, 200);
  }
}

test("payload: any dataset either fits the cap or throws; upcoming events and groups always stay", () => {
  const rand = prng(20261102);
  for (let round = 0; round < 40; round++) {
    const n = 1 + Math.floor(rand() * 60);
    const events = Array.from({ length: n }, () =>
      row({
        startsAt: hours(Math.floor(rand() * 2000) - 1000),
        title: noise(1 + Math.floor(rand() * 2000)),
        description: rand() < 0.2 ? null : noise(Math.floor(rand() * 20_000)),
        venueName: rand() < 0.5 ? null : noise(Math.floor(rand() * 2000)),
        address: noise(Math.floor(rand() * 2000)),
        tags: Array.from({ length: Math.floor(rand() * 50) }, () => noise(1 + Math.floor(rand() * 100))),
      }),
    );
    const groups = Array.from({ length: Math.floor(rand() * 5) }, (_, i) => ({
      ...GROUP_A,
      id: `9a000000-1111-4222-8333-0000000002${String(i).padStart(2, "0")}`,
      slug: `r${i}`,
      name: noise(1 + Math.floor(rand() * 1000)),
      description: noise(Math.floor(rand() * 20_000)),
    }));
    const full = payloadStoredBytes(enc(events, groups));
    const cap = Math.max(400, Math.floor(full * (0.05 + rand())));
    let payload;
    try {
      payload = enc(events, groups, cap);
    } catch (err) {
      assert.ok(err instanceof PublicDataTooLargeError, `round ${round}: ${String(err)}`);
      assert.ok(err.bytes > cap);
      continue;
    }
    assert.ok(payloadStoredBytes(payload) <= cap, `round ${round}: ${payloadStoredBytes(payload)} > ${cap}`);
    const data = decodePublicPayload(payload);
    assert.deepEqual(upcomingIds(data.events), upcomingIds(events), `round ${round}: upcoming kept`);
    assert.equal(data.groups.length, groups.length, `round ${round}: groups kept`);
    assert.equal(data.events.length, events.length - payload.reduced.pastEvents);
  }
});

test("refill backoff: none after the first failure, then 30 s, doubling, capped at 15 min", () => {
  assert.equal(nextBackoffMs(0), 0);
  assert.equal(nextBackoffMs(1), 0);
  assert.equal(nextBackoffMs(2), 30_000);
  assert.equal(nextBackoffMs(3), 60_000);
  assert.equal(nextBackoffMs(6), 480_000);
  assert.equal(nextBackoffMs(7), 900_000);
  assert.equal(nextBackoffMs(50), 900_000);
});

test("size alert: none under the warning size, warn above it or for a cut field, urgent once data is dropped", () => {
  const base = { warnBytes: 1500, limitBytes: 2000, ageMs: 3600_000 };
  const none = NO_REDUCTIONS;
  assert.equal(detectPublicDataSize({ ...base, bytes: 1500, reduced: none }), null);
  assert.equal(detectPublicDataSize({ ...base, bytes: 1501, reduced: none })?.level, "warn");
  assert.equal(detectPublicDataSize({ ...base, bytes: 10, reduced: { ...none, capped: 1 } })?.level, "warn");
  const trimmed = detectPublicDataSize({ ...base, bytes: 1000, reduced: { ...none, pastDescriptions: 3 } });
  assert.equal(trimmed?.level, "urgent");
  assert.equal(trimmed?.category, "public_data_size");
  const severe = detectPublicDataSize({ ...base, bytes: 1000, reduced: { ...none, pastEvents: 2 } });
  assert.equal(severe?.level, "urgent");
  assert.equal(severe?.key, "public_data_size:severe");
  assert.match(severe?.body ?? "", /2 of the oldest past events were left out/);
});

test("size alert: an entry that has not refilled for three cron runs is urgent", () => {
  const base = { warnBytes: 1500, limitBytes: 2000, bytes: 10, reduced: NO_REDUCTIONS };
  assert.equal(detectPublicDataSize({ ...base, ageMs: PUBLIC_DATA_MAX_AGE_MS }), null);
  const stale = detectPublicDataSize({ ...base, ageMs: PUBLIC_DATA_MAX_AGE_MS + 1 });
  assert.equal(stale?.level, "urgent");
  assert.equal(stale?.key, "public_data_size:stale");
  assert.equal(publicDataUnavailableAlert(new Error("boom")).level, "urgent");
});

test("payload: a different version is refused", () => {
  const payload = encodePublicPayload({ events: [], groups: [], enabledSourceCount: 0 }, NOW);
  assert.throws(() => decodePublicPayload({ ...payload, v: 999 }));
});

/* ---- filterPublicEvents ---- */

test("filter: started events drop out at render time, no refill needed", () => {
  const soon = row({ startsAt: hours(1) });
  const later = row({ startsAt: hours(10) });
  const data = build([soon, later]);
  assert.deepEqual(ids(filterPublicEvents(data, filters(), { now: NOW, limit: 200 })), [soon.id, later.id]);
  assert.deepEqual(ids(filterPublicEvents(data, filters(), { now: hours(2), limit: 200 })), [later.id]);
  /* Exactly at start still counts as upcoming (>=). */
  assert.equal(countPublicEvents(data, filters(), hours(1)), 2);
});

test("filter: online is hidden by default and shown with online=show", () => {
  const live = row();
  const online = row({ isOnline: true });
  const data = build([live, online]);
  assert.deepEqual(ids(filterPublicEvents(data, filters(), { now: NOW, limit: 200 })), [live.id]);
  const shown = filterPublicEvents(data, parseFilters({ online: "show" }), { now: NOW, limit: 200 });
  assert.deepEqual(new Set(ids(shown)), new Set([live.id, online.id]));
});

test("filter: from and to bound the start date", () => {
  const a = row({ startsAt: new Date("2026-11-10T18:00:00Z") });
  const b = row({ startsAt: new Date("2026-11-20T18:00:00Z") });
  const c = row({ startsAt: new Date("2026-12-05T18:00:00Z") });
  const data = build([a, b, c]);
  const f = filters({ from: "2026-11-15", to: "2026-11-30" });
  /* Same end-of-day rule as before, computed the same way so the test
     does not depend on the machine's time zone. */
  const to = new Date("2026-11-30");
  to.setHours(23, 59, 59, 999);
  const expected = [b, c].filter((e) => e.startsAt.getTime() <= to.getTime()).map((e) => e.id);
  assert.deepEqual(ids(filterPublicEvents(data, f, { now: NOW, limit: 200 })), expected);
  /* A from in the past shows started events too. */
  const past = row({ startsAt: hours(-5) });
  const data2 = build([past]);
  assert.equal(countPublicEvents(data2, filters({ from: "2026-11-01" }), NOW), 1);
});

test("filter: q matches title, description, venue or address, case-insensitive, % literal", () => {
  const t = row({ title: "Rust Night" });
  const d = row({ description: "We talk RUST here" });
  const v = row({ venueName: "Rusty Bucket" });
  const ad = row({ address: "1 Rust Way" });
  const none = row({ title: "Go meetup", description: null, venueName: null, address: null });
  const pct = row({ title: "100% uptime talk" });
  const data = build([t, d, v, ad, none, pct]);
  assert.deepEqual(
    new Set(ids(filterPublicEvents(data, filters({ q: "rust" }), { now: NOW, limit: 200 }))),
    new Set([t.id, d.id, v.id, ad.id]),
  );
  assert.deepEqual(ids(filterPublicEvents(data, filters({ q: "100%" }), { now: NOW, limit: 200 })), [pct.id]);
  /* % is not a wildcard any more. */
  assert.equal(countPublicEvents(data, filters({ q: "r%t" }), NOW), 0);
});

test("filter: cities match exactly, and Unknown selects null cities", () => {
  const lehi = row({ city: "Lehi" });
  const provo = row({ city: "Provo" });
  const none = row({ city: null, venueName: null, address: null });
  const data = build([lehi, provo, none]);
  const got = filterPublicEvents(data, parseFilters({ cities: "Lehi,Unknown" }), { now: NOW, limit: 200 });
  assert.deepEqual(new Set(ids(got)), new Set([lehi.id, none.id]));
  assert.equal(countPublicEvents(data, parseFilters({ cities: "lehi" }), NOW), 0);
});

test("filter: groups match by slug", () => {
  const inGroup = row({ groupId: GROUP_A.id });
  const other = row();
  const data = build([inGroup, other]);
  assert.deepEqual(ids(filterPublicEvents(data, parseFilters({ groups: "utah-js" }), { now: NOW, limit: 200 })), [inGroup.id]);
  assert.equal(countPublicEvents(data, parseFilters({ groups: GROUP_A.id }), NOW), 0);
});

test("filter: tags include old spellings and special weeks inside their dates", () => {
  const founders = row({ tags: ["founders"] });
  const oldSpelling = row({ tags: ["startup"] });
  const ai = row({ tags: ["ai"] });
  const data = build([founders, oldSpelling, ai]);
  const got = filterPublicEvents(data, parseFilters({ tags: "founders" }), { now: NOW, limit: 200 });
  assert.deepEqual(new Set(ids(got)), new Set([founders.id, oldSpelling.id]));

  /* Hard Tech Week runs Oct 26-30 2026 (lib/special-weeks.ts). */
  const before = new Date("2026-10-01T00:00:00Z");
  const inWeek = row({ title: "Zero Gravity Summit", tags: [], startsAt: new Date("2026-10-28T16:00:00Z") });
  const outWeek = row({ title: "Zero Gravity Summit", tags: [], startsAt: new Date("2026-11-20T16:00:00Z") });
  const tagged = row({ title: "Panel", tags: ["hard-tech-week"], startsAt: new Date("2026-10-27T16:00:00Z") });
  const data2 = build([inWeek, outWeek, tagged]);
  const week = filterPublicEvents(data2, parseFilters({ tags: "hard-tech-week" }), { now: before, limit: 200 });
  assert.deepEqual(new Set(ids(week)), new Set([inWeek.id, tagged.id]));
});

test("filter: sources and types", () => {
  const paidConf = row({ source: "luma", isPaid: true, isConference: true });
  const free = row({ source: "meetup" });
  const penciled = row({ source: "meetup", isTentative: true, isPaid: true });
  const data = build([paidConf, free, penciled]);
  const q = (p: Record<string, string>) =>
    new Set(ids(filterPublicEvents(data, parseFilters(p), { now: NOW, limit: 200 })));
  assert.deepEqual(q({ sources: "luma" }), new Set([paidConf.id]));
  assert.deepEqual(q({ types: "free" }), new Set([free.id]));
  assert.deepEqual(q({ types: "conference" }), new Set([paidConf.id]));
  assert.deepEqual(q({ types: "penciled" }), new Set([penciled.id]));
  assert.deepEqual(q({ types: "paid,free" }), new Set([paidConf.id, free.id, penciled.id]));
});

test("filter: regions apply before the limit", () => {
  const slc = Array.from({ length: 5 }, (_, i) => row({ city: "Salt Lake City", startsAt: hours(1 + i) }));
  const provo = row({ city: "Provo", startsAt: hours(20) });
  const data = build([...slc, provo]);
  const got = filterPublicEvents(data, parseFilters({ regions: "Utah County" }), { now: NOW, limit: 2 });
  assert.deepEqual(ids(got), [provo.id]);
  assert.equal(filterPublicEvents(data, filters(), { now: NOW, limit: 3 }).length, 3);
  assert.equal(countPublicEvents(data, filters(), NOW), 6);
});

test("filter: never mutates the dataset", () => {
  const data = build([row({ startsAt: hours(3) }), row({ startsAt: hours(1) })]);
  const before = ids(data.events);
  recentlyAdded(data, NOW);
  filterPublicEvents(data, filters(), { now: NOW, limit: 1 });
  assert.deepEqual(ids(data.events), before);
});

/* ---- counts ---- */

test("counts: Unknown city bucket, canonical tags once, groups only when set, sorted", () => {
  const data = build([
    row({ city: "Lehi", tags: ["startup", "founders"], groupId: GROUP_A.id, source: "luma" }),
    row({ city: "Lehi", tags: ["ai"], source: "meetup" }),
    row({ city: "Provo", tags: ["ai"], source: "meetup" }),
    row({ city: null, venueName: null, address: null, tags: null, source: "meetup" }),
    row({ city: "", tags: ["ai"], source: "meetup" }),
    row({ city: "Ogden", isOnline: true, tags: ["ai"] }),
    row({ city: "Ogden", startsAt: hours(-3), tags: ["ai"] }),
  ]);
  assert.deepEqual(cityCounts(data, NOW), [
    { city: "Lehi", count: 2 },
    { city: "Provo", count: 1 },
    { city: "Unknown", count: 1 },
  ]);
  assert.deepEqual(tagCounts(data, NOW), [
    { tag: "ai", count: 3 },
    { tag: "founders", count: 1 },
  ]);
  assert.deepEqual(sourceCounts(data, NOW), [
    { source: "meetup", count: 4 },
    { source: "luma", count: 1 },
  ]);
  assert.deepEqual(groupCounts(data, NOW), [{ slug: "utah-js", name: "Utah JS", count: 1 }]);
});

test("recentlyAdded: upcoming in person, newest first", () => {
  const old = row({ createdAt: new Date("2026-09-01T00:00:00Z") });
  const fresh = row({ createdAt: new Date("2026-10-30T00:00:00Z") });
  const online = row({ isOnline: true, createdAt: new Date("2026-10-31T00:00:00Z") });
  const past = row({ startsAt: hours(-1), createdAt: new Date("2026-10-31T00:00:00Z") });
  const data = build([old, fresh, online, past]);
  assert.deepEqual(ids(recentlyAdded(data, NOW)), [fresh.id, old.id]);
  assert.deepEqual(ids(recentlyAdded(data, NOW, 1)), [fresh.id]);
});

/* ---- slug lookups (404s without the database) ---- */

test("findEventByParam: slug, wrong title, uppercase UUID, unknown and garbage", () => {
  const e = row({ id: "c0ffee12-1111-4222-8333-444455556666", title: "Rust Night" });
  const data = build([e]);
  const canonical = eventSlug(e.title, e.id);
  assert.equal(findEventByParam(data, canonical)?.id, e.id);
  assert.equal(findEventByParam(data, "some-old-title-c0ffee12")?.id, e.id);
  assert.equal(findEventByParam(data, e.id.toUpperCase())?.id, e.id);
  assert.equal(findEventByParam(data, "rust-night-deadbeef"), null);
  assert.equal(findEventByParam(data, "garbage"), null);
  assert.equal(findEventByParam(data, "9f1c2d3e-0000-4000-8000-000000000000"), null);
});

test("findEventByParam: hidden and pending events are not in the dataset", () => {
  /* The loader selects status='approved' only; a hidden id is simply absent. */
  const shown = row();
  const data = build([shown]);
  assert.equal(findEventByParam(data, "dddddddd-1111-4222-8333-000000000099"), null);
  assert.equal(findEventByParam(data, shown.id)?.id, shown.id);
});

test("cities: slug lookup and upcoming in-person list", () => {
  const a = row({ city: "Salt Lake City", startsAt: hours(5) });
  const b = row({ city: "Salt Lake City", startsAt: hours(-5) });
  const c = row({ city: "Salt Lake City", isOnline: true });
  const blank = row({ city: "  " });
  const data = build([a, b, c, blank]);
  assert.equal(cityFromSlug(data, "salt-lake-city"), "Salt Lake City");
  assert.equal(cityFromSlug(data, "zzz-123"), null);
  assert.equal(cityFromSlug(data, ""), null);
  assert.deepEqual(ids(cityEvents(data, "Salt Lake City", NOW)), [a.id]);
});

test("tags: upcoming slug lookup and the tag page list", () => {
  const upper = row({ tags: ["Robotics"], startsAt: hours(3) });
  const online = row({ tags: ["quantum"], isOnline: true });
  const pastOnly = row({ tags: ["retro"], startsAt: hours(-2) });
  const old = row({ tags: ["startup"] });
  const data = build([upper, online, pastOnly, old]);
  assert.equal(tagFromUpcomingSlug(data, "robotics", NOW), "robotics");
  assert.equal(tagFromUpcomingSlug(data, "quantum", NOW), "quantum");
  assert.equal(tagFromUpcomingSlug(data, "retro", NOW), null);
  assert.deepEqual(ids(tagEvents(data, "robotics", NOW)), [upper.id]);
  assert.deepEqual(ids(tagEvents(data, "quantum", NOW)), []);
  assert.deepEqual(ids(tagEvents(data, "founders", NOW)), [old.id]);

  const before = new Date("2026-10-01T00:00:00Z");
  const week = row({ title: "Hard Tech Week kickoff", tags: [], startsAt: new Date("2026-10-26T16:00:00Z") });
  assert.deepEqual(ids(tagEvents(build([week]), "hard-tech-week", before)), [week.id]);
});

test("groups: slug lookup any status, upcoming list includes online, capped at 50", () => {
  const evs = Array.from({ length: 55 }, (_, i) => row({ groupId: GROUP_A.id, startsAt: hours(1 + i), isOnline: i === 0 }));
  const past = row({ groupId: GROUP_A.id, startsAt: hours(-1) });
  const data = build([...evs, past]);
  assert.equal(groupBySlug(data, "old-group")?.status, "hidden");
  assert.equal(groupBySlug(data, "zzz"), null);
  const up = groupUpcoming(data, GROUP_A.id, NOW);
  assert.equal(up.length, 50);
  assert.equal(up[0].id, evs[0].id);
});

test("eventsInRange: from inclusive, to exclusive, online and past included", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-11-01T00:00:00Z");
  const first = row({ startsAt: from, isOnline: true });
  const edge = row({ startsAt: to });
  const mid = row({ startsAt: new Date("2026-10-15T00:00:00Z") });
  const data = build([first, edge, mid]);
  assert.deepEqual(ids(eventsInRange(data, from, to)), [first.id, mid.id]);
});

test("sitemapInputs: rows counted like each page counts", () => {
  const data = build([
    row({ city: "Lehi", tags: ["ai"] }),
    row({ city: "Lehi", isOnline: true, tags: ["ai"] }),
    row({ city: " ", tags: ["ai"] }),
    row({ city: "Lehi", startsAt: new Date("2025-11-15T00:00:00Z") }),
    row({ city: "Lehi", startsAt: new Date("2024-01-15T00:00:00Z") }),
  ]);
  const s = sitemapInputs(data, NOW);
  assert.equal(s.upcoming.length, 3);
  assert.deepEqual(s.cityRows, [{ city: "Lehi", n: 1 }]);
  assert.equal(s.tagRows.length, 2);
  assert.deepEqual(s.monthRows, [
    { y: 2025, m: 11, n: 1 },
    { y: 2026, m: 11, n: 3 },
  ]);
  assert.deepEqual(s.groupRows, [{ slug: "utah-js" }]);
});
