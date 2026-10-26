import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeSpecialWeeks,
  getSpecialWeek,
  specialWeekDates,
  specialWeekHref,
  specialWeekTagsFor,
  tagLabel,
} from "../src/lib/special-weeks";

const at = (iso: string) => new Date(iso);

test("titles earn the Hard Tech Week tag only inside the week", () => {
  const during = at("2026-10-28T18:00:00Z");
  assert.deepEqual(specialWeekTagsFor({ title: "Hard Tech Week Opening Party", startsAt: during }), ["hard-tech-week"]);
  assert.deepEqual(specialWeekTagsFor({ title: "HardTech Week mixer", startsAt: during }), ["hard-tech-week"]);
  assert.deepEqual(specialWeekTagsFor({ title: "Zero Gravity Summit Day 1", startsAt: during }), ["hard-tech-week"]);
  assert.deepEqual(specialWeekTagsFor({ title: "Hard Tech Hackathon Judging", startsAt: during }), ["hard-tech-week"]);
  assert.deepEqual(specialWeekTagsFor({ title: "Rust Meetup", startsAt: during }), []);
  /* Host briefings in August are on the calendar but not in the week. */
  assert.deepEqual(specialWeekTagsFor({ title: "Hard Tech Week Host Briefing", startsAt: at("2026-08-26T17:30:00Z") }), []);
});

test("the event window is Denver days, inclusive", () => {
  const title = "Hard Tech Week wrap";
  /* Oct 30 11:30pm MDT = Oct 31 05:30Z: still Friday in Utah. */
  assert.deepEqual(specialWeekTagsFor({ title, startsAt: at("2026-10-31T05:30:00Z") }), ["hard-tech-week"]);
  /* Oct 31 00:30 MDT is Saturday. */
  assert.deepEqual(specialWeekTagsFor({ title, startsAt: at("2026-10-31T06:30:00Z") }), []);
  /* Oct 26 00:30 MDT is Monday. */
  assert.deepEqual(specialWeekTagsFor({ title, startsAt: at("2026-10-26T06:30:00Z") }), ["hard-tech-week"]);
  assert.deepEqual(specialWeekTagsFor({ title, startsAt: at("2026-10-26T05:30:00Z") }), []);
});

test("the banner shows Oct 19 through Oct 30 in Denver", () => {
  const slugs = (iso: string) => activeSpecialWeeks(at(iso)).map((w) => w.slug);
  assert.deepEqual(slugs("2026-10-19T05:59:00Z"), []); /* Oct 18 11:59pm MDT */
  assert.deepEqual(slugs("2026-10-19T06:00:00Z"), ["hard-tech-week"]); /* Oct 19 00:00 MDT */
  assert.deepEqual(slugs("2026-10-25T14:00:00Z"), ["hard-tech-week"]);
  assert.deepEqual(slugs("2026-10-31T05:59:00Z"), ["hard-tech-week"]); /* Oct 30 11:59pm MDT */
  assert.deepEqual(slugs("2026-10-31T06:00:00Z"), []); /* Oct 31 00:00 MDT */
});

test("labels, dates and link", () => {
  const w = getSpecialWeek("hard-tech-week")!;
  assert.equal(specialWeekDates(w), "Oct 26 to 30");
  assert.equal(specialWeekDates({ ...w, eventFrom: "2026-10-30", eventTo: "2026-11-03" }), "Oct 30 to Nov 3");
  assert.equal(specialWeekHref(w), "/tag/hard-tech-week");
  assert.equal(tagLabel("hard-tech-week"), "Hard Tech Week");
  assert.equal(tagLabel("ai"), "ai");
  /* Copy rule: no em dashes. */
  assert.doesNotMatch(`${w.label} ${w.blurb}`, /—/);
});
