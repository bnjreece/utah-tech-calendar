import { describe, expect, test } from "bun:test";
import { listingKey, matchTitles, placeRelation, planQueueTwinHides, type QueueTwinRow } from "@/lib/queue-twins";

/* Real pending pairs from the production queue (2026-10-25), plus the
   events that must never merge. */

const FRESH = new Date("2026-10-25T15:00:00Z");
const STALE = new Date("2026-09-28T03:00:00Z");
let seq = 0;

function row(p: Partial<QueueTwinRow> & { title: string; startsAt: Date }): QueueTwinRow {
  seq++;
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`,
    source: "eventbrite",
    externalId: null,
    link: `https://www.eventbrite.com/e/listing-tickets-10000000${String(seq).padStart(5, "0")}`,
    venueName: null,
    latitude: null,
    longitude: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: FRESH,
    statusLocked: false,
    status: "pending",
    city: null,
    ...p,
  };
}

const OCT31 = new Date("2026-10-31T16:00:00Z");
const DEC14 = new Date("2026-12-15T01:00:00Z");
const TECHSPO_AT = new Date("2027-10-28T15:00:00Z");

const bitcoinOld = row({ title: "2026 Bitcoin Conference: Saturday October 31st", startsAt: OCT31, venueName: "Fulton Library", city: "Orem", createdAt: new Date("2026-08-24T00:00:00Z") });
const bitcoinUvu = row({ title: "UVU 2026 Bitcoin Conference: Saturday October 31st", startsAt: OCT31, venueName: "Fulton Library", city: "Orem", createdAt: new Date("2026-09-05T00:00:00Z") });
const hackerFresh = row({ title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Provo", city: "Provo", createdAt: new Date("2026-07-31T00:00:00Z") });
const hackerStale = row({ title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Utah County", city: "Utah County", createdAt: new Date("2026-09-06T00:00:00Z"), updatedAt: STALE });
const techspoOld = row({
  title: "TECHSPO Salt Lake City 2027 Technology Expo (Internet ~ AdTech ~ MarTech)",
  startsAt: TECHSPO_AT, venueName: "Hilton Salt Lake City Center", city: "Salt Lake City",
  link: "https://www.eventbrite.com/e/techspo-salt-lake-city-2027-technology-expo-internet-adtech-martech-tickets-1996064919908",
  createdAt: new Date("2026-09-02T00:00:00Z"), updatedAt: new Date("2026-10-12T06:00:00Z"),
});
const techspoNew = row({
  title: "TECHSPO Salt Lake City 2027 Technology Expo (AI ~ SaaS ~ AdTech ~ MarTech)",
  startsAt: TECHSPO_AT, venueName: "Hilton Salt Lake City Center", city: "Salt Lake City",
  link: "https://www.eventbrite.com/e/techspo-salt-lake-city-2027-technology-expo-ai-saas-adtech-martech-tickets-1996064919908",
  createdAt: new Date("2026-10-22T00:00:00Z"),
});

const hides = (rows: QueueTwinRow[]) =>
  planQueueTwinHides(rows).map((h) => [h.hide.title, h.keep.title]);

describe("planQueueTwinHides: the real queue pairs", () => {
  test("Bitcoin: org prefix is the only difference; the oldest stays", () => {
    expect(hides([bitcoinUvu, bitcoinOld])).toEqual([[bitcoinUvu.title, bitcoinOld.title]]);
  });
  test("HackerX: same title and minute, city-only venues; the oldest stays", () => {
    const plan = planQueueTwinHides([hackerStale, hackerFresh]);
    expect(plan.map((h) => [h.hide.id, h.keep.id])).toEqual([[hackerStale.id, hackerFresh.id]]);
  });
  test("TECHSPO: one Eventbrite id under two slugs; the oldest stays", () => {
    const plan = planQueueTwinHides([techspoOld, techspoNew]);
    expect(plan.map((h) => h.hide.id)).toEqual([techspoNew.id]);
  });
  test("all three at once hide exactly three rows", () => {
    expect(planQueueTwinHides([bitcoinOld, bitcoinUvu, hackerFresh, hackerStale, techspoOld, techspoNew])).toHaveLength(3);
  });
});

describe("planQueueTwinHides: who stays", () => {
  test("a pending twin of an approved row is hidden, the approved row is never touched", () => {
    const pub = row({ ...bitcoinUvu, id: "a", status: "approved", createdAt: new Date("2026-10-20T00:00:00Z") });
    const plan = planQueueTwinHides([bitcoinOld, pub]);
    expect(plan.map((h) => [h.hide.id, h.keep.id])).toEqual([[bitcoinOld.id, "a"]]);
  });
  test("two approved twins are left to the approved sweep", () => {
    expect(planQueueTwinHides([{ ...bitcoinOld, status: "approved" }, { ...bitcoinUvu, status: "approved" }])).toEqual([]);
  });
  test("the attendee listing beats an older employer ticket", () => {
    const employer = row({ title: "Women in Tech 2026 - Salt Lake City Employer Ticket", startsAt: OCT31, venueName: "Nice", city: "Sandy", createdAt: new Date("2026-08-01T00:00:00Z") });
    const attendee = row({ title: "Women in Tech 2026 - Salt Lake City", startsAt: OCT31, venueName: "Nice", city: "Sandy", createdAt: new Date("2026-09-01T00:00:00Z") });
    expect(planQueueTwinHides([employer, attendee]).map((h) => h.hide.id)).toEqual([employer.id]);
  });
  test("locked and manual rows are never hidden", () => {
    expect(planQueueTwinHides([bitcoinOld, { ...bitcoinUvu, statusLocked: true }]).map((h) => h.hide.id)).toEqual([bitcoinOld.id]);
    expect(planQueueTwinHides([{ ...bitcoinOld, source: "manual" }, { ...bitcoinUvu, source: "manual" }])).toEqual([]);
    expect(planQueueTwinHides([{ ...bitcoinOld, statusLocked: true }, { ...bitcoinUvu, statusLocked: true }])).toEqual([]);
  });
  test("hidden rows are ignored", () => {
    expect(planQueueTwinHides([bitcoinOld, { ...bitcoinUvu, status: "hidden" }])).toEqual([]);
  });
});

describe("planQueueTwinHides: distinct events stay", () => {
  const party = new Date("2026-11-07T01:00:00Z");
  test("a VIP section is not the main party", () => {
    const main = row({ title: "Hard Tech Week Opening Party", startsAt: party, venueName: "Clark Planetarium", city: "Salt Lake City" });
    const vip = row({ title: "Hard Tech Week Opening Party VIP Section", startsAt: party, venueName: "Clark Planetarium", city: "Salt Lake City" });
    const vip2 = row({ title: "Hard Tech Week Opening Party (VIP)", startsAt: party, venueName: "Clark Planetarium", city: "Salt Lake City" });
    const after = row({ title: "Hard Tech Week Opening Party After Party", startsAt: party, venueName: "Clark Planetarium", city: "Salt Lake City" });
    expect(hides([main, vip, vip2, after])).toEqual([]);
  });
  test("two dates of a series", () => {
    const p7 = row({ title: "The Biological Evaluation Puzzle: Building a Complete ISO 10993 Strategy Webinar Series: Part 7", startsAt: new Date("2026-10-28T08:00:00Z"), city: "Salt Lake City" });
    const p8 = row({ title: "The Biological Evaluation Puzzle: Building a Complete ISO 10993 Strategy Webinar Series: Part 7", startsAt: new Date("2026-11-11T08:00:00Z"), city: "Salt Lake City" });
    expect(hides([p7, p8])).toEqual([]);
  });
  test("the same day in a different session or part", () => {
    const d = new Date("2026-11-10T16:00:00Z");
    expect(hides([row({ title: "Utah AI Summit 2026 (Day 1)", startsAt: d, venueName: "Kiln" }), row({ title: "Utah AI Summit 2026 (Day 2)", startsAt: d, venueName: "Kiln" })])).toEqual([]);
    expect(hides([row({ title: "Silicon Slopes Founder Summit", startsAt: d, venueName: "Kiln" }), row({ title: "Silicon Slopes Founder Summit Workshop", startsAt: d, venueName: "Kiln" })])).toEqual([]);
  });
  test("a short generic title in two cities, or one city with no venue evidence and two words", () => {
    const d = new Date("2026-11-12T01:00:00Z");
    expect(hides([row({ title: "Monthly Meetup", startsAt: d, venueName: "Provo", city: "Provo" }), row({ title: "Monthly Meetup", startsAt: d, venueName: "Ogden", city: "Ogden", source: "meetup" })])).toEqual([]);
    expect(hides([row({ title: "Monthly Meetup", startsAt: d, city: "Lehi" }), row({ title: "Monthly Meetup", startsAt: d, city: "Lehi" })])).toEqual([]);
  });
  test("the same title at two named venues, or two times without the same link", () => {
    const d = new Date("2026-11-12T01:00:00Z");
    expect(hides([row({ title: "Rust Utah Night", startsAt: d, venueName: "Kiln, 26 S Rio Grande St", city: "Salt Lake City" }), row({ title: "Rust Utah Night", startsAt: d, venueName: "Kiln, 2701 N Thanksgiving Way", city: "Lehi" })])).toEqual([]);
    expect(hides([row({ title: "AI Builders Lab Utah", startsAt: d, venueName: "Kiln" }), row({ title: "AI Builders Lab Utah", startsAt: new Date(d.getTime() + 60 * 60 * 1000), venueName: "Kiln" })])).toEqual([]);
  });
  test("a contained title at a different venue, or with too many extra words", () => {
    const d = new Date("2026-11-12T01:00:00Z");
    expect(hides([row({ title: "Utah Life Sciences Summit 2026", startsAt: d, venueName: "Salt Palace" }), row({ title: "BioUtah's Utah Life Sciences Summit 2026", startsAt: d, venueName: "Grand America" })])).toEqual([]);
    expect(hides([row({ title: "Utah Life Sciences Summit 2026", startsAt: d, venueName: "Salt Palace" }), row({ title: "Women of BioUtah Mentoring Circle at Utah Life Sciences Summit 2026", startsAt: d, venueName: "Salt Palace" })])).toEqual([]);
  });
});

describe("planQueueTwinHides: places must be compatible (Astra round 1)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test("one source, one title, one minute, city-only venues in two cities", () => {
    expect(hides([
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Provo", city: "Provo" }),
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Ogden", city: "Ogden" }),
    ])).toEqual([]);
    expect(hides([
      row({ title: "Rust Builders Night", startsAt: d, city: "Provo" }),
      row({ title: "Rust Builders Night", startsAt: d, city: "Ogden" }),
    ])).toEqual([]);
  });
  test("a shared named venue in two different cities", () => {
    expect(hides([
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City" }),
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Lehi" }),
    ])).toEqual([]);
  });
  test("a county only contains its own cities", () => {
    expect(hides([
      row({ title: "HackerX - Weber - Employer Ticket", startsAt: d, venueName: "Utah County", city: "Utah County" }),
      row({ title: "HackerX - Weber - Employer Ticket", startsAt: d, venueName: "Ogden", city: "Ogden" }),
    ])).toEqual([]);
    expect(hides([
      row({ title: "HackerX - Weber - Employer Ticket", startsAt: d, venueName: "Weber County", city: "Weber County" }),
      row({ title: "HackerX - Weber - Employer Ticket", startsAt: d, venueName: "Ogden", city: "Ogden" }),
    ])).toEqual([]);
  });
  test("a county and a city in it need the same source", () => {
    expect(hides([
      row({ title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Provo", city: "Provo" }),
      row({ title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Utah County", city: "Utah County", source: "meetup" }),
    ])).toEqual([]);
  });
  test("placeRelation", () => {
    const at = (city: string | null) => row({ title: "x", startsAt: d, city });
    expect(placeRelation(at("Provo"), at("provo"))).toBe("same");
    expect(placeRelation(at("Utah County"), at("Provo"))).toBe("county");
    expect(placeRelation(at("Salt Lake County"), at("Provo"))).toBe("conflict");
    expect(placeRelation(at("Provo"), at("Ogden"))).toBe("conflict");
    expect(placeRelation(at(null), at("Ogden"))).toBe("unknown");
  });
});

describe("planQueueTwinHides: placeholder venues are not evidence (Astra round 1)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test.each(["TBD", "Online", "Zoom", "To be announced"])("venue %s", (venue) => {
    /* Different sources, cities and links. */
    expect(hides([
      row({ title: "Monthly Meetup", startsAt: d, venueName: venue, city: "Provo" }),
      row({ title: "Monthly Meetup", startsAt: d, venueName: venue, city: "Ogden", source: "meetup" }),
    ])).toEqual([]);
    /* No cities at all: the placeholder still proves nothing. */
    expect(hides([
      row({ title: "Utah Product Leaders Monthly Meetup", startsAt: d, venueName: venue }),
      row({ title: "Utah Product Leaders Monthly Meetup", startsAt: d, venueName: venue, source: "meetup" }),
    ])).toEqual([]);
    expect(hides([
      row({ title: "Utah Product Leaders Meetup", startsAt: d, venueName: venue }),
      row({ title: "SLC Utah Product Leaders Meetup", startsAt: d, venueName: venue, source: "meetup" }),
    ])).toEqual([]);
  });
  test("an exact title at a placeholder venue in one county is not a county match", () => {
    expect(hides([
      row({ title: "Utah Product Leaders Meetup", startsAt: d, venueName: "TBD", city: "Utah County" }),
      row({ title: "Utah Product Leaders Meetup", startsAt: d, venueName: "TBD", city: "Provo" }),
    ])).toEqual([]);
  });
});

describe("planQueueTwinHides: venues and sessions (Astra round 2)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test("one city, two different named venues, no pins: two events", () => {
    expect(hides([
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City" }),
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Salt Lake City Public Library", city: "Salt Lake City", createdAt: new Date("2026-09-10T00:00:00Z") }),
    ])).toEqual([]);
  });
  test("one city, one named venue and one city-only venue still match", () => {
    const a = row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City" });
    const b = row({ title: "Rust Builders Night", startsAt: d, venueName: "Salt Lake City", city: "Salt Lake City", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([a, b])).toEqual([[b.title, a.title]]);
  });
  test("one source, one registration link, two start times: two sessions", () => {
    const link = "https://example.org/register/makerspace-tour";
    const at = (h: number) => new Date(Date.UTC(2026, 10, 12, h));
    expect(hides([
      row({ title: "Community Makerspace Tour", source: "html-calendar", externalId: "tour-1600", link, startsAt: at(16), venueName: "Lehi Makerspace", city: "Lehi" }),
      row({ title: "Community Makerspace Tour", source: "html-calendar", externalId: "tour-1700", link, startsAt: at(17), venueName: "Lehi Makerspace", city: "Lehi" }),
    ])).toEqual([]);
  });
  test("the same link at two start times from two sources is still one listing", () => {
    const link = "https://example.org/register/makerspace-tour";
    const a = row({ title: "Community Makerspace Tour", source: "html-calendar", link, startsAt: new Date("2026-11-12T16:00:00Z"), city: "Lehi" });
    const b = row({ title: "Community Makerspace Tour", source: "luma", link, startsAt: new Date("2026-11-12T16:30:00Z"), city: "Lehi", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([a, b])).toEqual([[b.title, a.title]]);
  });
  test("an approved session never hides a pending session of the same source at another time", () => {
    const link = "https://example.org/register/makerspace-tour";
    const approved = row({ title: "Community Makerspace Tour", source: "html-calendar", link, startsAt: new Date("2026-11-12T16:00:00Z"), status: "approved" });
    const pending = row({ title: "Community Makerspace Tour", source: "html-calendar", link, startsAt: new Date("2026-11-12T17:00:00Z") });
    expect(hides([approved, pending])).toEqual([]);
  });
});

describe("matchTitles and listingKey", () => {
  test("title matches", () => {
    expect(matchTitles("HackerX - Employer Ticket", "HackerX - Employer Ticket")).toBe("exact");
    expect(matchTitles("TECHSPO SLC 2027 Expo (AI ~ SaaS)", "TECHSPO SLC 2027 Expo (Internet)")).toBe("core");
    expect(matchTitles("UVU 2026 Bitcoin Conference: Saturday October 31st", "2026 Bitcoin Conference: Saturday October 31st")).toBe("contained");
    expect(matchTitles("Opening Party", "Opening Party VIP")).toBeNull();
    expect(matchTitles("TBD", "TBD")).toBeNull();
  });
  test("Eventbrite ids survive a renamed slug; other links normalize", () => {
    expect(listingKey("https://www.eventbrite.com/e/a-b-tickets-1996064919908?aff=x")).toBe("eventbrite:1996064919908");
    expect(listingKey("https://www.eventbrite.com/e/c-d-tickets-1996064919908")).toBe("eventbrite:1996064919908");
    expect(listingKey("https://luma.com/abc/")).toBe("lu.ma/abc");
    expect(listingKey(null)).toBeNull();
  });
});

describe("planQueueTwinHides: the venue veto runs first (Astra round 3)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  const kiln = () => row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City", link: "https://example.org/kiln" });
  test("a Luma calendar pointer at a different named venue is another event", () => {
    const lib = row({ title: "Rust Builders Night", startsAt: d, venueName: "Salt Lake City Public Library", city: "Salt Lake City", source: "luma", externalId: "calev-library", link: "https://luma.com/library", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([kiln(), lib])).toEqual([]);
  });
  test("two different named venues with pins about 111 m apart are two events", () => {
    const a = row({ ...kiln(), latitude: 40.76, longitude: -111.89 });
    const b = row({ title: "Rust Builders Night", startsAt: d, venueName: "Salt Lake City Public Library", city: "Salt Lake City", latitude: 40.761, longitude: -111.89, link: "https://example.org/library", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([a, b])).toEqual([]);
  });
  test("positive controls: one named venue, or a city-only venue, with near pins or a pointer still match", () => {
    const a = row({ ...kiln(), latitude: 40.76, longitude: -111.89 });
    const b = row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City", latitude: 40.7605, longitude: -111.89, link: "https://example.org/kiln-2", source: "meetup", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([a, b])).toEqual([[b.title, a.title]]);
    const k = kiln();
    const ptr = row({ title: "Rust Builders Night", startsAt: d, venueName: null, city: "Salt Lake City", source: "luma", externalId: "calev-x", link: "https://luma.com/x", createdAt: new Date("2026-09-10T00:00:00Z") });
    expect(hides([k, ptr])).toEqual([[ptr.title, k.title]]);
  });
});

describe("planQueueTwinHides: keeper agrees with the classifier (Astra round 3)", () => {
  test("identical same-link pending listings keep the OLDER row, even when the newer one was refreshed later", () => {
    const link = "https://www.eventbrite.com/e/rust-night-tickets-1234567890123";
    const older = row({ title: "Rust Builders Night SLC", startsAt: OCT31, link, venueName: "Kiln", city: "Salt Lake City", createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-20T00:00:00Z") });
    const newer = row({ title: "Rust Builders Night SLC", startsAt: OCT31, link, venueName: "Kiln", city: "Salt Lake City", createdAt: new Date("2026-10-10T00:00:00Z"), updatedAt: new Date("2026-10-25T00:00:00Z") });
    expect(planQueueTwinHides([newer, older]).map((h) => [h.hide.id, h.keep.id])).toEqual([[newer.id, older.id]]);
  });
  test("equal created_at breaks on id, like (created_at, id) in SQL", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const a = row({ ...bitcoinOld, id: "00000000-0000-0000-0000-00000000000b", createdAt: at });
    const b = row({ ...bitcoinOld, id: "00000000-0000-0000-0000-00000000000a", createdAt: at });
    expect(planQueueTwinHides([a, b]).map((h) => h.keep.id)).toEqual([b.id]);
  });
});

describe("planQueueTwinHides: shared links never override places (Astra round 4)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  const later = new Date("2026-09-10T00:00:00Z");
  test("query-addressed events at different cities are two events (the reproduction)", () => {
    const a = row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", city: "Salt Lake City", source: "meetup", externalId: "101", link: "https://example.org/event?id=101" });
    const b = row({ title: "Rust Builders Night", startsAt: d, venueName: "Provo Library", city: "Provo", source: "meetup", externalId: "202", link: "https://example.org/event?id=202", createdAt: later });
    expect(listingKey(a.link)).not.toBe(listingKey(b.link));
    expect(hides([a, b])).toEqual([]);
  });
  test("one shared registration URL at two cities, two venues or far-apart pins is still two events", () => {
    const link = "https://example.org/register";
    const base = { title: "Rust Builders Night", startsAt: d, source: "meetup", link };
    const slc = row({ ...base, venueName: "Kiln", city: "Salt Lake City" });
    expect(hides([slc, row({ ...base, venueName: "Provo Library", city: "Provo", createdAt: later })])).toEqual([]);
    expect(hides([slc, row({ ...base, venueName: "Salt Lake City Public Library", city: "Salt Lake City", createdAt: later })])).toEqual([]);
    const pinA = row({ ...base, latitude: 40.762, longitude: -111.903 });
    const pinB = row({ ...base, latitude: 40.24, longitude: -111.658, createdAt: later });
    expect(hides([pinA, pinB])).toEqual([]);
    /* Different minutes, two sources, one link, two cities: still two. */
    const x = row({ ...base, venueName: "Kiln", city: "Salt Lake City" });
    const y = row({ ...base, source: "luma", startsAt: new Date(d.getTime() + 30 * 60 * 1000), venueName: "Provo Library", city: "Provo", createdAt: later });
    expect(hides([x, y])).toEqual([]);
  });
  test("positive controls: a shared link with compatible places, and Eventbrite tracking params, still match", () => {
    const link = "https://example.org/register";
    const a = row({ title: "Rust Builders Night", startsAt: d, source: "meetup", link, venueName: "Kiln", city: "Salt Lake City" });
    const b = row({ title: "Rust Builders Night", startsAt: d, source: "meetup", link, venueName: null, city: "Salt Lake City", createdAt: later });
    expect(hides([a, b])).toEqual([[b.title, a.title]]);
    const eb1 = row({ title: "Rust Builders Night", startsAt: d, link: "https://www.eventbrite.com/e/rust-night-tickets-1998617983189?aff=oddtdtcreator", city: "Salt Lake City" });
    const eb2 = row({ title: "Rust Builders Night", startsAt: d, link: "https://www.eventbrite.com/e/rust-builders-night-tickets-1998617983189?utm_source=x&keep=1", city: "Salt Lake City", createdAt: later });
    expect(listingKey(eb1.link)).toBe("eventbrite:1998617983189");
    expect(listingKey(eb2.link)).toBe("eventbrite:1998617983189");
    expect(hides([eb1, eb2])).toEqual([[eb2.title, eb1.title]]);
  });
});

describe("planQueueTwinHides: differing parentheticals need one listing (Astra round 5)", () => {
  const d = new Date("2026-11-12T16:00:00Z");
  const later = new Date("2026-09-10T00:00:00Z");
  const at = { startsAt: d, venueName: "Salt Lake Community College", city: "Salt Lake City" };
  test("Beginner vs Advanced at one venue and minute, separate links, stay (the reproduction)", () => {
    const beg = row({ title: "Python Programming Workshop (Beginner)", ...at });
    const adv = row({ title: "Python Programming Workshop (Advanced)", ...at, createdAt: later });
    expect(matchTitles(beg.title, adv.title)).toBe("core");
    expect(hides([beg, adv])).toEqual([]);
  });
  test("other qualifiers, a bare title vs a qualified one, and pins within 250 m also stay", () => {
    const a = row({ title: "Intro to Data Science Bootcamp (Teens)", ...at });
    const b = row({ title: "Intro to Data Science Bootcamp (Adults)", ...at, createdAt: later });
    expect(hides([a, b])).toEqual([]);
    const bare = row({ title: "Intro to Data Science Bootcamp", ...at, createdAt: later });
    expect(hides([a, bare])).toEqual([]);
    const pinA = row({ title: "Python Programming Workshop (Beginner)", startsAt: d, latitude: 40.762, longitude: -111.903, city: "Salt Lake City" });
    const pinB = row({ title: "Python Programming Workshop (Advanced)", startsAt: d, latitude: 40.7621, longitude: -111.9031, city: "Salt Lake City", createdAt: later });
    expect(hides([pinA, pinB])).toEqual([]);
    /* Containment across differing parentheticals is held to the same bar. */
    const c1 = row({ title: "Salt Lake Python Programming Workshop (Beginner)", ...at });
    const c2 = row({ title: "Python Programming Workshop Series (Advanced)", ...at, createdAt: later });
    expect(hides([c1, c2])).toEqual([]);
  });
  test("positive controls: one Eventbrite id across differing parentheticals, and equal parentheticals at one venue, still match", () => {
    const beg = row({ title: "Python Programming Workshop (Beginner)", ...at, link: "https://www.eventbrite.com/e/python-workshop-beginner-tickets-1998617983190" });
    const ren = row({ title: "Python Programming Workshop (Beginners)", ...at, link: "https://www.eventbrite.com/e/python-workshop-beginners-tickets-1998617983190", createdAt: later });
    expect(hides([beg, ren])).toEqual([[ren.title, beg.title]]);
    const x = row({ title: "Utah Rust Builders Monthly Social Club (SLC)", ...at });
    const y = row({ title: "Rust Builders Monthly Social Club (SLC)", ...at, createdAt: later });
    expect(hides([x, y])).toEqual([[y.title, x.title]]);
  });
});
