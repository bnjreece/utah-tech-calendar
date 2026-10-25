import assert from "node:assert/strict";
import { test } from "node:test";
import { findSameDayTwins, normalizeLink, type TwinRow } from "../src/lib/same-day-twins";

const now = new Date("2026-10-25T14:00:00Z");
let n = 0;
function row(o: Partial<TwinRow> & { id: string }): TwinRow {
  n++;
  return {
    title: "Hard Tech Week Opening Party",
    source: "luma",
    externalId: `evt-${n}`,
    link: `https://lu.ma/link${n}`,
    venueName: null,
    latitude: null,
    longitude: null,
    startsAt: new Date("2026-10-27T00:00:00Z"),
    createdAt: new Date("2026-09-25T00:00:00Z"),
    updatedAt: new Date("2026-10-25T12:00:00Z"),
    statusLocked: false,
    ...o,
  };
}

test("an external listing on the official calendar is a twin of the event it points at", () => {
  /* Real rows (2026-10-25): the calendar's Women in Tech entry links to the
     Eventbrite page we already scrape; its Vibe Code Club entry links to
     Tickettailor while we have the Silicon Slopes listing, same minute. */
  const eb = row({
    id: "eb",
    source: "eventbrite",
    externalId: "https://www.eventbrite.com/e/women-in-tech-salt-lake-city-2026-tickets-1998431363003",
    link: "https://www.eventbrite.com/e/women-in-tech-salt-lake-city-2026-tickets-1998431363003",
    title: "Women in Tech Salt Lake City 2026",
    venueName: "NiCE",
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
  const wit = row({
    id: "wit",
    externalId: "calev-drrq40L0MTcIyso",
    link: "https://www.eventbrite.com/e/women-in-tech-salt-lake-city-2026-tickets-1998431363003?aff=x",
    title: "Women in Tech Salt Lake City 2026",
    latitude: 40.5758504,
    longitude: -111.8920156,
  });
  const ss = row({
    id: "ss",
    source: "silicon_slopes",
    externalId: "vibe-code-club",
    link: "https://www.siliconslopes.com/c/events/vibe-code-club",
    title: "Vibe Code Club for Entrepreneurs",
    venueName: "Silicon Slopes",
    startsAt: new Date("2026-10-27T17:30:00Z"),
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
  const vibe = row({
    id: "vibe",
    externalId: "calev-v7lKg1icjsSsUAc",
    link: "https://www.tickettailor.com/events/utahveteranbusinessresourcecenter/2327380",
    title: "Vibe Code Club for Entrepreneurs",
    startsAt: new Date("2026-10-27T17:30:00Z"),
  });
  const clusters = findSameDayTwins([wit, eb, vibe, ss], now);
  assert.equal(clusters.length, 2);
  const w = clusters.find((c) => c.keep.id === "eb")!;
  assert.deepEqual(w.drop.map((r) => r.id), ["wit"]);
  const v = clusters.find((c) => c.keep.id === "ss")!;
  assert.deepEqual(v.drop.map((r) => r.id), ["vibe"]);

  /* The calendar pointer needs the same minute, not just the window. */
  const vibeLater = { ...vibe, startsAt: new Date("2026-10-27T18:00:00Z") };
  assert.deepEqual(findSameDayTwins([vibeLater, ss], now), []);
});

test("same title, day and time with no shared link or venue are NOT twins", () => {
  const slc = row({
    id: "slc",
    title: "Monthly Meetup",
    source: "meetup",
    venueName: "Kiln, 26 S Rio Grande St, Salt Lake City",
    latitude: "40.766",
    longitude: "-111.904",
  });
  const provo = row({
    id: "provo",
    title: "Monthly Meetup",
    source: "meetup",
    venueName: "Startup Building, 560 S 100 W, Provo",
    latitude: "40.226",
    longitude: "-111.661",
  });
  const unknown = row({ id: "unknown", title: "Monthly Meetup", source: "luma" });
  assert.deepEqual(findSameDayTwins([slc, provo, unknown], now), []);
});

test("one venue name in two places is NOT a twin: conflicting pins or addresses win", () => {
  /* Astra round 2: Kiln has a Salt Lake City and a Lehi space. */
  const slc = row({ id: "slc", title: "Monthly Meetup", source: "meetup", venueName: "Kiln, 26 S Rio Grande St, Salt Lake City", latitude: "40.766", longitude: "-111.904" });
  const lehi = row({ id: "lehi", title: "Monthly Meetup", source: "luma", venueName: "Kiln, 2701 N Thanksgiving Way, Lehi", latitude: "40.428", longitude: "-111.893" });
  assert.deepEqual(findSameDayTwins([slc, lehi], now), []);
  /* Same venue text, pins about 38 km apart. */
  const lehiNamed = { ...lehi, venueName: "Kiln" };
  const slcNamed = { ...slc, venueName: "Kiln" };
  assert.deepEqual(findSameDayTwins([slcNamed, lehiNamed], now), []);
  /* No pins, but the venues name different cities or streets. */
  const a = row({ id: "a", title: "Monthly Meetup", venueName: "Kiln, Salt Lake City" });
  const b = row({ id: "b", title: "Monthly Meetup", source: "meetup", venueName: "Kiln, Lehi" });
  assert.deepEqual(findSameDayTwins([a, b], now), []);
  /* A pin conflict also defeats the calendar-pointer evidence. */
  const ptr = row({ id: "ptr", title: "Monthly Meetup", externalId: "calev-abc", latitude: "40.428", longitude: "-111.893" });
  assert.deepEqual(findSameDayTwins([slc, ptr], now), []);
  /* Pins a few hundred meters apart (two geocoders, one building) with the
     same venue name are still one event. */
  const near = { ...lehiNamed, id: "near", latitude: "40.7695", longitude: "-111.904" };
  assert.equal(findSameDayTwins([slcNamed, near], now).length, 1);
});

test("separate sessions need the same link from another source", () => {
  /* Astra round 2: one source, same venue, an hour apart = two sessions. */
  const v = "Fortem Technologies, 1064 S North County Blvd";
  const nine = row({ id: "nine", title: "Facility Tour", venueName: v, startsAt: new Date("2026-10-30T15:00:00Z"), createdAt: new Date("2026-09-01T00:00:00Z") });
  const ten = row({ id: "ten", title: "Facility Tour", venueName: v, startsAt: new Date("2026-10-30T16:00:00Z") });
  assert.deepEqual(findSameDayTwins([nine, ten], now), []);
  /* Same link, same source, different times: still two sessions. */
  assert.deepEqual(findSameDayTwins([nine, { ...ten, link: nine.link }], now), []);
  /* Another source, same venue, 30 minutes off: not enough. */
  const eb = row({ id: "eb", title: "Facility Tour", source: "eventbrite", venueName: v, startsAt: new Date("2026-10-30T15:30:00Z") });
  assert.deepEqual(findSameDayTwins([nine, eb], now), []);
  /* Another source with the same link 30 minutes off: one event. */
  const [c] = findSameDayTwins([nine, { ...eb, link: nine.link }], now);
  assert.equal(c.keep.id, "nine");
  assert.deepEqual(c.drop.map((r) => r.id), ["eb"]);
});

test("same venue or map pins within 250 m are twins; a deleted listing elsewhere is not", () => {
  const a = row({ id: "a", venueName: "Traeger Grills Headquarters, 533 S 400 W", createdAt: new Date("2026-09-01T00:00:00Z") });
  const b = row({ id: "b", source: "eventbrite", venueName: "Traeger Grills Headquarters" });
  const c = row({ id: "c", latitude: 40.7556, longitude: -111.9006 });
  const d = row({ id: "d", source: "meetup", latitude: 40.7570, longitude: -111.9010 });
  const [ab] = findSameDayTwins([a, b], now);
  assert.equal(ab.keep.id, "a");
  assert.deepEqual(ab.drop.map((r) => r.id), ["b"]);
  assert.equal(findSameDayTwins([c, d], now).length, 1);

  /* The July Opening Party at Clark Planetarium (deleted on Luma, 6:30pm)
     vs the live 6:00pm one at Traeger: different link, venue and minute.
     Hidden by hand in ops/2026-10-25, not by the sweep. */
  const stale = row({
    id: "stale",
    venueName: "Clark Planetarium, 110 400 W",
    startsAt: new Date("2026-10-27T00:30:00Z"),
    createdAt: new Date("2026-07-08T00:00:00Z"),
    updatedAt: new Date("2026-09-16T12:00:00Z"),
  });
  assert.deepEqual(findSameDayTwins([stale, a], now), []);
});

test("freshness ranks the kept row; leftovers form their own cluster", () => {
  const venue = "Clark Planetarium";
  const stale = row({ id: "stale", venueName: venue, createdAt: new Date("2026-07-08T00:00:00Z"), updatedAt: new Date("2026-09-16T12:00:00Z") });
  const live = row({ id: "live", venueName: venue });
  const vip = row({ id: "vip", title: "VIP Section: Hard Tech Week Opening Party", venueName: venue });
  const [c, ...rest] = findSameDayTwins([stale, live, vip], now);
  assert.equal(rest.length, 0);
  assert.equal(c.keep.id, "live");
  assert.deepEqual(c.drop.map((r) => r.id), ["stale"]);

  /* x is kept; y has no evidence with x, but z shares y's venue. */
  const x = row({ id: "x", title: "Demo Night", venueName: "Kiln", createdAt: new Date("2026-08-01T00:00:00Z") });
  const y = row({ id: "y", title: "Demo Night", venueName: "Church & State", createdAt: new Date("2026-08-02T00:00:00Z") });
  const z = row({ id: "z", title: "Demo Night", venueName: "Church & State, 370 S 300 E", createdAt: new Date("2026-08-03T00:00:00Z") });
  const out = findSameDayTwins([z, y, x], now);
  assert.equal(out.length, 1);
  assert.equal(out[0].keep.id, "y");
  assert.deepEqual(out[0].drop.map((r) => r.id), ["z"]);
});

test("sessions hours apart, other days, locked rows and placeholder titles are left alone", () => {
  const v = "Fortem Technologies";
  const am = row({ id: "am", title: "Fortem Facility Tour", venueName: v, startsAt: new Date("2026-10-30T15:00:00Z") });
  const pm = row({ id: "pm", title: "Fortem Facility Tour", venueName: v, startsAt: new Date("2026-10-30T19:00:00Z") });
  const nextDay = row({ id: "nd", title: "Fortem Facility Tour", venueName: v, startsAt: new Date("2026-10-31T15:00:00Z") });
  const tbd1 = row({ id: "t1", title: "TBD", venueName: v });
  const tbd2 = row({ id: "t2", title: "TBD", source: "meetup", venueName: v });
  assert.deepEqual(findSameDayTwins([am, pm, nextDay, tbd1, tbd2], now), []);

  const locked = row({ id: "locked", venueName: v, statusLocked: true, createdAt: new Date("2026-10-20T00:00:00Z") });
  const other = row({ id: "other", venueName: v });
  const [c] = findSameDayTwins([other, locked], now);
  assert.equal(c.keep.id, "locked");
  const lockedTwo = row({ id: "l2", venueName: v, statusLocked: true });
  assert.deepEqual(findSameDayTwins([locked, lockedTwo], now), []);

  /* "Online" is not a venue. */
  const o1 = row({ id: "o1", title: "Webinar", venueName: "Online" });
  const o2 = row({ id: "o2", title: "Webinar", venueName: "online" });
  assert.deepEqual(findSameDayTwins([o1, o2], now), []);
});

test("links compare across lu.ma / luma.com, www, case, tracking query and trailing slash", () => {
  assert.equal(normalizeLink("https://luma.com/Z9G8NKKK/?utm=x#y"), normalizeLink("https://lu.ma/z9g8nkkk"));
  assert.equal(normalizeLink("https://www.eventbrite.com/e/a"), normalizeLink("http://eventbrite.com/e/a/"));
  assert.equal(normalizeLink("not a url"), null);
});

test("identity-bearing query keys are kept; tracking keys are dropped (Astra queue round 4)", () => {
  assert.notEqual(normalizeLink("https://example.org/event?id=101"), normalizeLink("https://example.org/event?id=202"));
  assert.equal(normalizeLink("https://example.org/event?id=101&utm_source=x"), normalizeLink("https://example.org/event/?id=101"));
  assert.equal(normalizeLink("https://example.org/e?b=2&a=1"), normalizeLink("https://example.org/e?a=1&b=2"));
  assert.equal(
    normalizeLink("https://www.eventbrite.com/e/above-beyond-tickets-2002090077316?aff=oddtdtcreator"),
    normalizeLink("https://www.eventbrite.com/e/above-beyond-tickets-2002090077316"),
  );
  assert.equal(
    normalizeLink("https://bioutah.growthzoneapp.com/ap/Events/Register/abc?sourceTypeId=Website"),
    normalizeLink("https://bioutah.growthzoneapp.com/ap/Events/Register/abc"),
  );
});

test("a shared link never overrides conflicting locations (Astra queue round 4)", () => {
  const shared = "https://example.org/register";
  const kiln = row({ id: "k", title: "Rust Builders Night", link: shared, venueName: "Kiln, 26 S Rio Grande St, Salt Lake City", latitude: 40.762, longitude: -111.903 });
  const provo = row({ id: "p", title: "Rust Builders Night", link: shared, venueName: "Provo Library, 550 N University Ave, Provo", latitude: 40.24, longitude: -111.658 });
  assert.deepEqual(findSameDayTwins([kiln, provo], now), []);
  /* Positive control: same link, no conflicting place, still one event. */
  const twin = row({ id: "t", title: "Rust Builders Night", link: shared, source: "eventbrite" });
  assert.equal(findSameDayTwins([kiln, twin], now).length, 1);
});
