import { describe, expect, test } from "bun:test";
import { listingKey, plainTitle, planQueueTwinHides, type QueueTwinRow } from "@/lib/queue-twins";

/* Real pending pairs from the production queue (2026-10-25), plus the
   events that must never merge. Since Astra round 6 only two kinds of
   evidence count: the same upstream listing id, or a stale relist. */

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
  test("TECHSPO: one Eventbrite id under two slugs; the stale slug goes, the one still scraped stays", () => {
    const p = plan([techspoOld, techspoNew]);
    expect(p.map((h) => [h.hide.id, h.keep.id, h.evidence])).toEqual([[techspoOld.id, techspoNew.id, "listing"]]);
  });
  test("HackerX: two ids, same title and start; the stale relist goes", () => {
    const p = plan([hackerStale, hackerFresh]);
    expect(p.map((h) => [h.hide.id, h.keep.id, h.evidence])).toEqual([[hackerStale.id, hackerFresh.id, "relist"]]);
  });
  test("Bitcoin: different ids and titles are left for a human", () => {
    expect(plan([bitcoinOld, bitcoinUvu])).toEqual([]);
  });
  test("all six at once hide exactly the two stale rows", () => {
    const hidden = plan([bitcoinOld, bitcoinUvu, hackerFresh, hackerStale, techspoOld, techspoNew]).map((h) => h.hide.id);
    expect(hidden.sort()).toEqual([hackerStale.id, techspoOld.id].sort());
  });
});

describe("A. same listing", () => {
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

describe("B. stale relist", () => {
  const d = new Date("2026-11-12T01:00:00Z");
  test("plainTitle only normalizes case, whitespace and punctuation", () => {
    expect(plainTitle("  HackerX -  Utah County!! ")).toBe("hackerx utah county");
    expect(plainTitle("Workshop (Beginner)")).not.toBe(plainTitle("Workshop (Advanced)"));
    expect(plainTitle("HackerX - Employer Ticket")).not.toBe(plainTitle("HackerX"));
  });
  test("punctuation and case differences still match a stale relist", () => {
    const fresh = row({ title: "Rust Builders Night", startsAt: d });
    const stale = row({ title: "rust builders night!", startsAt: d, updatedAt: STALE });
    expect(pairs([stale, fresh])).toEqual([[stale.id, fresh.id]]);
  });
  test("two rows the scraper still sees are never merged (two chapters, one time)", () => {
    expect(plan([row({ title: "Rust Builders Night", startsAt: d }), row({ title: "Rust Builders Night", startsAt: d })])).toEqual([]);
  });
  test("two stale rows are never merged", () => {
    expect(plan([row({ title: "Rust Builders Night", startsAt: d, updatedAt: STALE }), row({ title: "Rust Builders Night", startsAt: d, updatedAt: STALE })])).toEqual([]);
  });
  test("a different start minute, or a different source, is not a relist", () => {
    expect(plan([row({ title: "Rust Builders Night", startsAt: d, updatedAt: STALE }), row({ title: "Rust Builders Night", startsAt: new Date(d.getTime() + 60_000) })])).toEqual([]);
    expect(plan([row({ title: "Rust Builders Night", startsAt: d, updatedAt: STALE }), row({ title: "Rust Builders Night", startsAt: d, source: "meetup" })])).toEqual([]);
  });
  test("placeholder titles never relist", () => {
    expect(plan([row({ title: "TBD", startsAt: d, updatedAt: STALE }), row({ title: "TBD", startsAt: d })])).toEqual([]);
  });
});

/* Every false merge from Astra rounds 1 to 6: distinct events with
   separate listings, one stale, the other still scraped. None may merge. */
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
  test("one title at University of Utah and at Kiln is merged only by the stale-relist rule, never by venue", () => {
    /* Both still scraped: two events. */
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
  test("same listing: the row still scraped beats an older stale one", () => {
    const old = row({ title: "Rust Night", startsAt: d, link, createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: STALE });
    const fresh = row({ title: "Rust Night", startsAt: d, link: `${link}?aff=x`, createdAt: new Date("2026-10-01T00:00:00Z") });
    expect(pairs([old, fresh])).toEqual([[old.id, fresh.id]]);
  });
  test("same listing, both still scraped: the oldest stays; equal created_at breaks on id", () => {
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
    /* Stale relist: only the stale pending row goes, never a fresh one. */
    expect(pairs([hackerStale, { ...hackerFresh, status: "approved" }])).toEqual([[hackerStale.id, hackerFresh.id]]);
    expect(plan([{ ...hackerStale, status: "approved" }, hackerFresh])).toEqual([]);
  });
  test("two approved twins are left to the approved sweep; hidden rows are ignored", () => {
    expect(plan([{ ...techspoOld, status: "approved" }, { ...techspoNew, status: "approved" }])).toEqual([]);
    expect(plan([techspoOld, { ...techspoNew, status: "hidden" }])).toEqual([]);
  });
});
