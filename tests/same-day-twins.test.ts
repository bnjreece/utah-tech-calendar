import assert from "node:assert/strict";
import { test } from "node:test";
import { findSameDayTwins, type TwinRow } from "../src/lib/same-day-twins";

const now = new Date("2026-10-25T14:00:00Z");
function row(o: Partial<TwinRow> & { id: string }): TwinRow {
  return {
    title: "Hard Tech Week Opening Party",
    source: "luma",
    startsAt: new Date("2026-10-27T00:00:00Z"),
    createdAt: new Date("2026-09-25T00:00:00Z"),
    updatedAt: new Date("2026-10-25T12:00:00Z"),
    statusLocked: false,
    ...o,
  };
}

test("a stale deleted-and-reposted listing loses to the live one, even though it is older", () => {
  const live = row({ id: "live" });
  const stale = row({
    id: "stale",
    startsAt: new Date("2026-10-27T00:30:00Z"),
    createdAt: new Date("2026-07-08T00:00:00Z"),
    updatedAt: new Date("2026-09-16T12:00:00Z"),
  });
  const vip = row({ id: "vip", title: "VIP Section: Hard Tech Week Opening Party" });
  const [c, ...rest] = findSameDayTwins([stale, live, vip], now);
  assert.equal(rest.length, 0);
  assert.equal(c.keep.id, "live");
  assert.deepEqual(c.drop.map((r) => r.id), ["stale"]);
});

test("the same event from two sources keeps the older row", () => {
  const eb = row({ id: "eb", source: "eventbrite", title: "Women in Tech Salt Lake City 2026", createdAt: new Date("2026-09-01T00:00:00Z") });
  const lu = row({ id: "lu", title: "Women in Tech Salt Lake City 2026" });
  const [c] = findSameDayTwins([lu, eb], now);
  assert.equal(c.keep.id, "eb");
  assert.deepEqual(c.drop.map((r) => r.id), ["lu"]);
});

test("sessions hours apart, other days, locked rows and placeholder titles are left alone", () => {
  const am = row({ id: "am", title: "Fortem Facility Tour", startsAt: new Date("2026-10-30T15:00:00Z") });
  const pm = row({ id: "pm", title: "Fortem Facility Tour", startsAt: new Date("2026-10-30T19:00:00Z") });
  const nextDay = row({ id: "nd", title: "Fortem Facility Tour", startsAt: new Date("2026-10-31T15:00:00Z") });
  const tbd1 = row({ id: "t1", title: "TBD" });
  const tbd2 = row({ id: "t2", title: "TBD", source: "meetup" });
  assert.deepEqual(findSameDayTwins([am, pm, nextDay, tbd1, tbd2], now), []);

  const locked = row({ id: "locked", statusLocked: true, createdAt: new Date("2026-10-20T00:00:00Z") });
  const other = row({ id: "other" });
  const [c] = findSameDayTwins([other, locked], now);
  assert.equal(c.keep.id, "locked");
  const lockedTwo = row({ id: "l2", statusLocked: true });
  assert.deepEqual(findSameDayTwins([locked, lockedTwo], now), []);
});
