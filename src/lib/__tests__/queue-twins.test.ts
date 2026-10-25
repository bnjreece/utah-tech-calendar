import { describe, expect, test } from "bun:test";
import { listingKey, planQueueTwinHides, type QueueTwinRow } from "@/lib/queue-twins";

/* Real pending pairs from the production queue (2026-10-25), plus the
   events that must never merge. Since Astra round 7 only one kind of
   evidence counts: the same upstream listing id from one source. */

const NOW = new Date("2026-10-25T18:00:00Z");
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
    ...p,
  };
}

const plan = (rows: QueueTwinRow[]) => planQueueTwinHides(rows, NOW);
const pairs = (rows: QueueTwinRow[]) => plan(rows).map((h) => [h.hide.id, h.keep.id]);

const OCT31 = new Date("2026-10-31T16:00:00Z");
const DEC14 = new Date("2026-12-15T01:00:00Z");
const TECHSPO_AT = new Date("2027-10-28T15:00:00Z");

const bitcoinOld = row({
  title: "2026 Bitcoin Conference: Saturday October 31st", startsAt: OCT31, venueName: "Fulton Library",
  link: "https://www.eventbrite.com/e/2026-bitcoin-conference-saturday-october-31st-tickets-1998617983189",
  createdAt: new Date("2026-08-24T03:00:00Z"),
});
const bitcoinUvu = row({
  title: "UVU 2026 Bitcoin Conference: Saturday October 31st", startsAt: OCT31, venueName: "Fulton Library",
  link: "https://www.eventbrite.com/e/uvu-2026-bitcoin-conference-saturday-october-31st-tickets-1999541399151",
  createdAt: new Date("2026-09-05T12:00:00Z"),
});
const hackerFresh = row({
  title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Provo",
  link: "https://www.eventbrite.com/e/hackerx-utah-county-employer-ticket-1214-tickets-1982701719215",
  createdAt: new Date("2026-07-31T00:01:00Z"),
});
const hackerStale = row({
  title: "HackerX - Utah County - Employer Ticket - 12/14", startsAt: DEC14, venueName: "Utah County",
  link: "https://www.eventbrite.com/e/hackerx-utah-county-employer-ticket-1214-tickets-1980426340496",
  createdAt: new Date("2026-09-06T06:00:00Z"), updatedAt: STALE,
});
const techspoOld = row({
  title: "TECHSPO Salt Lake City 2027 Technology Expo (Internet ~ AdTech ~ MarTech)",
  startsAt: TECHSPO_AT, venueName: "Hilton Salt Lake City Center",
  link: "https://www.eventbrite.com/e/techspo-salt-lake-city-2027-technology-expo-internet-adtech-martech-tickets-1996064919908",
  createdAt: new Date("2026-09-02T12:00:00Z"), updatedAt: new Date("2026-10-12T06:01:00Z"),
});
const techspoNew = row({
  title: "TECHSPO Salt Lake City 2027 Technology Expo (AI ~ SaaS ~ AdTech ~ MarTech)",
  startsAt: TECHSPO_AT, venueName: "Hilton Salt Lake City Center",
  link: "https://www.eventbrite.com/e/techspo-salt-lake-city-2027-technology-expo-ai-saas-adtech-martech-tickets-1996064919908",
  createdAt: new Date("2026-10-22T12:00:00Z"),
});

describe("the real queue pairs (2026-10-25)", () => {
  test("TECHSPO: one Eventbrite id under two slugs; the stale slug goes, the recently refreshed one stays", () => {
    expect(pairs([techspoOld, techspoNew])).toEqual([[techspoOld.id, techspoNew.id]]);
  });
  test("HackerX: two ids with one title and start go to a human, even with one row stale", () => {
    expect(plan([hackerStale, hackerFresh])).toEqual([]);
  });
  test("Bitcoin: different ids and titles are left for a human", () => {
    expect(plan([bitcoinOld, bitcoinUvu])).toEqual([]);
  });
  test("all six at once hide only the stale TECHSPO slug", () => {
    expect(pairs([bitcoinOld, bitcoinUvu, hackerFresh, hackerStale, techspoOld, techspoNew])).toEqual([[techspoOld.id, techspoNew.id]]);
  });
});

describe("same listing", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test("listingKey: Eventbrite, Meetup and Luma ids; anything else is not identity", () => {
    expect(listingKey("https://www.eventbrite.com/e/a-b-tickets-1996064919908?aff=x")).toBe("eventbrite:1996064919908");
    expect(listingKey("https://www.eventbrite.com/e/c-d-tickets-1996064919908")).toBe("eventbrite:1996064919908");
    expect(listingKey("https://www.eventbrite.com/e/1996064919908")).toBe("eventbrite:1996064919908");
    expect(listingKey("https://www.meetup.com/utah-kubernetes-meetup/events/316281874/")).toBe("meetup:316281874");
    expect(listingKey("https://luma.com/abc/")).toBe("luma:abc");
    expect(listingKey("https://zerogravitysummit.com/")).toBeNull();
    expect(listingKey("https://www.1millioncups.com/salt-lake-city")).toBeNull();
    expect(listingKey("https://example.org/event?id=101")).toBeNull();
    expect(listingKey("https://www.eventbrite.com/o/some-organizer-123456789012")).toBeNull();
    expect(listingKey(null)).toBeNull();
  });
  test("the same id under two slugs is one listing even with different titles", () => {
    const a = row({ title: "Rust Night", startsAt: d, link: "https://www.eventbrite.com/e/rust-night-tickets-1234567890123" });
    const b = row({ title: "Rust Night (renamed)", startsAt: d, link: "https://www.eventbrite.com/e/rust-night-renamed-tickets-1234567890123?aff=x", createdAt: new Date("2026-10-01T00:00:00Z") });
    expect(pairs([a, b])).toEqual([[b.id, a.id]]);
  });
  test("the same id from two different sources is left to the approved sweep", () => {
    const link = "https://www.eventbrite.com/e/rust-night-tickets-1234567890123";
    expect(plan([row({ title: "Rust Night", startsAt: d, link }), row({ title: "Rust Night", startsAt: d, link, source: "luma", externalId: "calev-x" })])).toEqual([]);
  });
  test("a shared non-listing link is never identity (Zero Gravity, recurrence sources)", () => {
    const link = "https://zerogravitysummit.com/";
    expect(plan([
      row({ title: "Zero Gravity Summit Day 1", startsAt: d, link, source: "luma", externalId: "calev-a" }),
      row({ title: "Zero Gravity Summit Day 1", startsAt: d, link, source: "luma", externalId: "calev-b" }),
    ])).toEqual([]);
    const cups = "https://www.1millioncups.com/salt-lake-city";
    expect(plan([
      row({ title: "1 Million Cups SLC", startsAt: d, link: cups, source: "recurrence:1mc-slc" }),
      row({ title: "1 Million Cups SLC", startsAt: new Date(d.getTime() + 3600_000), link: cups, source: "recurrence:1mc-slc" }),
    ])).toEqual([]);
  });
  test("a lu.ma link is identity only between two Luma event rows", () => {
    const link = "https://lu.ma/utah-ai";
    expect(plan([
      row({ title: "AI Night", startsAt: d, link, source: "silicon_slopes" }),
      row({ title: "Founder Night", startsAt: d, link, source: "silicon_slopes" }),
    ])).toEqual([]);
    const a = row({ title: "AI Night", startsAt: d, link, source: "luma", externalId: "evt-a" });
    const b = row({ title: "AI Night v2", startsAt: d, link, source: "luma", externalId: "evt-b", createdAt: new Date("2026-10-01T00:00:00Z") });
    expect(pairs([a, b])).toEqual([[b.id, a.id]]);
  });
  test("different days never match, even under one id", () => {
    const link = "https://www.eventbrite.com/e/rust-night-tickets-1234567890123";
    expect(plan([row({ title: "Rust Night", startsAt: d, link }), row({ title: "Rust Night", startsAt: new Date("2026-11-20T01:00:00Z"), link })])).toEqual([]);
  });
});

describe("one title, one start, two listing ids: never merged (Astra rounds 6 and 7)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test("two rows still refreshed, two stale rows, or one of each", () => {
    for (const [ua, ub] of [[FRESH, FRESH], [STALE, STALE], [STALE, FRESH]])
      expect(plan([row({ title: "Rust Builders Night", startsAt: d, updatedAt: ua }), row({ title: "Rust Builders Night", startsAt: d, updatedAt: ub })])).toEqual([]);
  });
  test("an admin approval refreshing one row never hides the other (Astra round 7 repro)", () => {
    const m = (id: string) => `https://www.meetup.com/rust-utah/events/${id}/`;
    const a = row({ title: "Rust Builders Night", startsAt: d, source: "meetup", link: m("316281874"), updatedAt: STALE });
    const b = row({ title: "Rust Builders Night", startsAt: d, source: "meetup", link: m("316281875"), updatedAt: STALE });
    expect(plan([a, b])).toEqual([]);
    /* approveEvent: status approved, locked, updated_at = now, no scrape. */
    const approved = { ...a, status: "approved", statusLocked: true, updatedAt: NOW };
    expect(plan([approved, b])).toEqual([]);
    /* Restore or send back to review: pending, locked, updated_at = now. */
    const restored = { ...a, statusLocked: true, updatedAt: NOW };
    expect(plan([restored, b])).toEqual([]);
  });
});

/* Every false merge from Astra rounds 1 to 6: distinct events with
   separate listings, one stale, the other recently refreshed. None may
   merge. */
describe("distinct events never merge (Astra rounds 1-6)", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  const pair = (staleTitle: string, freshTitle: string, s: Partial<QueueTwinRow> = {}, f: Partial<QueueTwinRow> = {}) =>
    plan([row({ title: staleTitle, startsAt: d, updatedAt: STALE, ...s }), row({ title: freshTitle, startsAt: d, ...f })]);
  test("parenthetical qualifiers: (Beginner) vs (Advanced)", () => {
    expect(pair("Python Workshop (Beginner)", "Python Workshop (Advanced)", { venueName: "SLCC" }, { venueName: "SLCC" })).toEqual([]);
  });
  test("an unparenthesized qualifier: \" - Advanced\"", () => {
    expect(pair("Python Data Science Bootcamp - Advanced", "Python Data Science Bootcamp")).toEqual([]);
    expect(pair("Python Data Science Bootcamp", "Python Data Science Bootcamp - Advanced")).toEqual([]);
  });
  test("one title at University of Utah and at Kiln, or at a museum ending in \"Utah\"", () => {
    expect(pair("Rust Builders Night", "Rust Builders Night", { venueName: "University of Utah" }, { venueName: "Kiln" })).toEqual([]);
    expect(plan([
      row({ title: "Rust Builders Night", startsAt: d, venueName: "University of Utah" }),
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln" }),
    ])).toEqual([]);
    expect(plan([
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Natural History Museum of Utah" }),
      row({ title: "Rust Builders Night", startsAt: d, venueName: "Kiln", source: "meetup" }),
    ])).toEqual([]);
  });
  test("a VIP section, an after party, a workshop, a contained title", () => {
    expect(pair("Hard Tech Week Opening Party VIP Section", "Hard Tech Week Opening Party")).toEqual([]);
    expect(pair("Hard Tech Week Opening Party (VIP)", "Hard Tech Week Opening Party")).toEqual([]);
    expect(pair("Hard Tech Week Opening Party After Party", "Hard Tech Week Opening Party")).toEqual([]);
    expect(pair("Silicon Slopes Founder Summit Workshop", "Silicon Slopes Founder Summit")).toEqual([]);
    expect(pair("UVU 2026 Bitcoin Conference", "2026 Bitcoin Conference")).toEqual([]);
  });
  test("Day 1 / Day 2 and Part 7 / Part 8", () => {
    expect(pair("Utah AI Summit 2026 (Day 1)", "Utah AI Summit 2026 (Day 2)")).toEqual([]);
    expect(pair("Webinar Series: Part 7", "Webinar Series: Part 8")).toEqual([]);
  });
  test("an employer ticket and the attendee listing", () => {
    expect(pair("Women in Tech 2026 - Employer Ticket", "Women in Tech 2026")).toEqual([]);
  });
  test("county vs city venues, placeholder venues, shared pins: no venue evidence at all", () => {
    expect(plan([
      row({ title: "HackerX - Utah County", startsAt: d, venueName: "Provo", latitude: 40.24, longitude: -111.66 }),
      row({ title: "HackerX - Utah County", startsAt: d, venueName: "Utah County", latitude: 40.24, longitude: -111.66 }),
    ])).toEqual([]);
    expect(plan([row({ title: "Rust Night", startsAt: d, venueName: "TBD" }), row({ title: "Rust Night", startsAt: d, venueName: "TBD" })])).toEqual([]);
  });
});

describe("who stays", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  const link = "https://www.eventbrite.com/e/rust-night-tickets-1234567890123";
  test("same listing: the recently refreshed row beats an older stale one", () => {
    const old = row({ title: "Rust Night", startsAt: d, link, createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: STALE });
    const fresh = row({ title: "Rust Night", startsAt: d, link: `${link}?aff=x`, createdAt: new Date("2026-10-01T00:00:00Z") });
    expect(pairs([old, fresh])).toEqual([[old.id, fresh.id]]);
  });
  test("same listing, both recently refreshed: the oldest stays; equal created_at breaks on id", () => {
    const old = row({ title: "Rust Night", startsAt: d, link, createdAt: new Date("2026-08-01T00:00:00Z") });
    const newer = row({ title: "Rust Night", startsAt: d, link: `${link}?aff=x`, createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-25T17:59:00Z") });
    expect(pairs([newer, old])).toEqual([[newer.id, old.id]]);
    const t = new Date("2026-09-01T00:00:00Z");
    const a = row({ id: "00000000-0000-0000-0000-00000000000b", title: "Rust Night", startsAt: d, link, createdAt: t });
    const b = row({ id: "00000000-0000-0000-0000-00000000000a", title: "Rust Night", startsAt: d, link: `${link}?aff=y`, createdAt: t });
    expect(plan([a, b]).map((h) => h.keep.id)).toEqual([b.id]);
  });
  test("a locked row stays, even stale; locked and manual rows are never hidden", () => {
    const locked = row({ title: "Rust Night", startsAt: d, link, updatedAt: STALE, statusLocked: true });
    const fresh = row({ title: "Rust Night", startsAt: d, link: `${link}?aff=x` });
    expect(pairs([fresh, locked])).toEqual([[fresh.id, locked.id]]);
    expect(plan([{ ...locked }, { ...fresh, statusLocked: true }])).toEqual([]);
    expect(plan([row({ title: "Rust Night", startsAt: d, link, source: "manual" }), row({ title: "Rust Night", startsAt: d, link: `${link}?aff=x`, source: "manual" })])).toEqual([]);
  });
  test("a pending twin of an approved row is hidden; the approved row is never touched", () => {
    const pub = { ...techspoNew, status: "approved" };
    expect(pairs([techspoOld, pub])).toEqual([[techspoOld.id, pub.id]]);
    /* Same listing: the pending row goes even when it is the fresh one. */
    expect(pairs([{ ...techspoOld, status: "approved" }, techspoNew])).toEqual([[techspoNew.id, techspoOld.id]]);
    /* Two listing ids never merge, approved or not. */
    expect(plan([hackerStale, { ...hackerFresh, status: "approved" }])).toEqual([]);
    expect(plan([{ ...hackerStale, status: "approved" }, hackerFresh])).toEqual([]);
  });
  test("two approved twins are left to the approved sweep; hidden rows are ignored", () => {
    expect(plan([{ ...techspoOld, status: "approved" }, { ...techspoNew, status: "approved" }])).toEqual([]);
    expect(plan([techspoOld, { ...techspoNew, status: "hidden" }])).toEqual([]);
  });
});
