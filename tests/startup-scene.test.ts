import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTUP_SCENE } from "../src/lib/startup-scene";
import { countThisWeek, mtRestOfWeekKeys } from "../src/lib/time";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const all = () => [...STARTUP_SCENE.recurring, ...STARTUP_SCENE.annual];

test("scene data carries its verification date", () => {
  assert.equal(STARTUP_SCENE.lastVerified, "2026-10-26");
  assert.ok(STARTUP_SCENE.recurring.length > 0);
  assert.ok(STARTUP_SCENE.annual.length > 0);
});

test("every entry has the required text and an https link", () => {
  for (const e of all()) {
    for (const k of ["name", "where", "blurb", "evidence"] as const) {
      assert.ok(e[k].trim().length > 0, `${e.name}: ${k}`);
    }
    const u = new URL(e.url);
    assert.equal(u.protocol, "https:", e.url);
    assert.ok(["high", "medium"].includes(e.confidence));
  }
  for (const m of STARTUP_SCENE.recurring) {
    assert.ok(m.cadence.trim(), m.name);
    assert.match(m.lastConfirmedEventDate, DAY);
    assert.ok(m.lastConfirmedEventDate <= STARTUP_SCENE.lastVerified, m.name);
    if (m.groupSlug !== null) assert.match(m.groupSlug, /^[a-z0-9-]+$/);
  }
  for (const a of STARTUP_SCENE.annual) assert.ok(a.when.trim(), a.name);
});

test("no em or en dashes in scene copy", () => {
  for (const e of all()) {
    for (const v of Object.values(e)) {
      if (typeof v === "string") assert.doesNotMatch(v, /[—–]/, `${e.name}: ${v}`);
    }
  }
});

test("names are unique", () => {
  const names = all().map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
});

test("this week runs through Sunday, Denver time", () => {
  /* Monday 2026-10-26, 10:00 MDT. */
  const now = new Date("2026-10-26T16:00:00Z");
  const keys = mtRestOfWeekKeys(now);
  assert.deepEqual([...keys].sort(), [
    "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
  ]);
  const n = countThisWeek(
    [
      "2026-10-26T15:00:00Z", // earlier today: already started
      "2026-10-28T15:00:00Z", // Wednesday
      "2026-11-02T05:00:00Z", // Sunday 10pm MST (after DST ends)
      "2026-11-02T08:00:00Z", // Monday 1am MST: next week
    ],
    now,
  );
  assert.equal(n, 2);
  /* Sunday evening: only the rest of today. */
  assert.deepEqual([...mtRestOfWeekKeys(new Date("2026-11-02T03:00:00Z"))], ["2026-11-01"]);
});
