import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { rescrapeUpdateValues, tagDescription } from "../src/lib/rescrape-values";
import { SPECIAL_WEEK_SLUGS } from "../src/lib/special-weeks";
import { appendTagsSql, rescrapeTagsSql } from "../src/lib/tag-merge";
import { llmTagPairs, tagImplicationPairs } from "../src/lib/auto-tag";

const dialect = new PgDialect();
const render = (s: SQL) => dialect.sqlToQuery(s);
/* The implication pairs (from, to, order) render first: the outer
   SELECT names them before the merged array. */
const IMP = tagImplicationPairs().length * 3;

const base = {
  title: "Albany Engineered Composites Tour",
  description: "Hosted by 47G.",
  link: "https://lu.ma/k9poepkf",
  venueName: "1 Albany Way",
  address: "1 Albany Way",
  city: "Salt Lake City",
  imageUrl: undefined as string | undefined,
  startsAt: new Date("2026-10-27T16:00:00Z"),
  tags: ["aerospace", "hard-tech-week"],
  groupId: "g1",
  isOnline: false,
  sourceId: "s1",
  updatedAt: new Date(),
};

test("a full rescrape writes every column and merges tags in SQL", () => {
  const v = rescrapeUpdateValues(base, { groupLocked: false, onlineLocked: false, partial: false });
  assert.equal(v.description, "Hosted by 47G.");
  assert.equal(v.venueName, "1 Albany Way");
  assert.equal(v.groupId, "g1");
  assert.equal(v.isOnline, false);
  const q = render(v.tags);
  /* The new tags, then the row's own week tags (read inside the UPDATE),
     de-duplicated in first-occurrence order. */
  assert.match(q.sql, /unnest\(coalesce\("events"\."tags", ARRAY\[\]::text\[\]\)\)/);
  assert.match(q.sql, /WITH ORDINALITY AS u\(t, o\) GROUP BY u\.t ORDER BY min\(u\.o\)/);
  assert.deepEqual(q.params.slice(IMP, IMP + 2), ["aerospace", "hard-tech-week"]);
});

test("a partial rescrape (detail fetch failed) refreshes title and times only and keeps only week tags from the row", () => {
  const v = rescrapeUpdateValues(base, { groupLocked: true, onlineLocked: false, partial: true });
  assert.equal(v.title, base.title);
  assert.equal(v.startsAt, base.startsAt);
  for (const k of ["description", "link", "venueName", "address", "city", "postalCode", "latitude", "longitude", "imageUrl"])
    assert.ok(!(k in v), k);
  assert.ok(!("isOnline" in v));
  assert.ok(!("groupId" in v));
  const q = render(v.tags);
  /* No keep-everything branch: stored tags survive only as week slugs,
     the rest is recomputed (from the stored body, see tagDescription). */
  assert.doesNotMatch(q.sql, /WHERE true\)/);
  assert.match(q.sql, /WHERE t = ANY\(ARRAY\[/);
  for (const slug of SPECIAL_WEEK_SLUGS) assert.ok(q.params.includes(slug), slug);
});

test("a partial rescrape tags from the stored body, a full one from the fresh body", () => {
  const stored = "A composites manufacturing tour with Hexcel engineers.";
  assert.equal(tagDescription({ description: "Hosted by 47G.", partial: true }, stored), stored);
  assert.equal(tagDescription({ description: "Hosted by 47G.", partial: true }, null), "Hosted by 47G.");
  assert.equal(tagDescription({ description: "Fresh body", partial: false }, stored), "Fresh body");
  assert.equal(tagDescription({ description: undefined }, stored), undefined);
});

test("every merge ends with the implications over the whole array (a kept week tag brings hard-tech)", () => {
  const pairs = tagImplicationPairs();
  assert.ok(pairs.some(([f, t]) => f === "hard-tech-week" && t === "hard-tech"));
  for (const s of [
    rescrapeTagsSql(["meetup"], { slugs: SPECIAL_WEEK_SLUGS }),
    rescrapeTagsSql(["meetup"], { slugs: SPECIAL_WEEK_SLUGS }, llmTagPairs()),
    appendTagsSql(["hard-tech-week"]),
  ]) {
    const q = render(s);
    assert.match(q.sql, /^\(SELECT x\.a \|\| ARRAY\(/);
    assert.match(q.sql, /WHERE m\.f = ANY\(x\.a\) AND NOT \(m\.t = ANY\(x\.a\)\)/);
  }
});

test("tag SQL handles empty arrays", () => {
  assert.match(render(rescrapeTagsSql([], { slugs: [] })).sql, /ARRAY\[\]::text\[\]/);
  const a = render(appendTagsSql(["hard-tech-week"]));
  assert.equal(a.params[IMP], "hard-tech-week");
});

test("a rescrape merges the row's stored classifier tags through the mapping, inside the UPDATE", () => {
  const pairs = llmTagPairs();
  const v = rescrapeUpdateValues(base, { groupLocked: false, onlineLocked: false, partial: false, llmPairs: pairs });
  const q = render(v.tags);
  /* Read from the row's own llm_verdict, not a value computed earlier. */
  assert.match(q.sql, /jsonb_array_elements_text\(CASE WHEN jsonb_typeof\("events"\."llm_verdict"->'suggestedTags'\) = 'array'/);
  assert.match(q.sql, /JOIN \(VALUES \(\$\d+::text, \$\d+::text\)/);
  assert.match(q.sql, /ON m\.f = lower\(btrim\(s\.v\)\)/);
  /* next tags, every (from, to) pair, the kept week slugs, then the
     implication pairs. */
  assert.equal(q.params.length, 2 + pairs.length * 2 + SPECIAL_WEEK_SLUGS.size + tagImplicationPairs().length * 3);
  assert.deepEqual(q.params.slice(IMP, IMP + 2), ["aerospace", "hard-tech-week"]);
  assert.deepEqual(q.params.slice(IMP + 2, IMP + 4), pairs[0]);
});
