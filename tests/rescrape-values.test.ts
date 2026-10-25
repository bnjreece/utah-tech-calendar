import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { rescrapeUpdateValues } from "../src/lib/rescrape-values";
import { appendTagsSql, rescrapeTagsSql } from "../src/lib/tag-merge";

const dialect = new PgDialect();
const render = (s: SQL) => dialect.sqlToQuery(s);

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
  /* The new tags, then the row's own week tags (read inside the UPDATE). */
  assert.match(q.sql, /unnest\(coalesce\("events"\."tags", ARRAY\[\]::text\[\]\)\)/);
  assert.deepEqual(q.params, ["aerospace", "hard-tech-week", "hard-tech-week", "aerospace", "hard-tech-week"]);
});

test("a partial rescrape (detail fetch failed) refreshes title and times only and keeps every stored tag", () => {
  const v = rescrapeUpdateValues(base, { groupLocked: true, onlineLocked: false, partial: true });
  assert.equal(v.title, base.title);
  assert.equal(v.startsAt, base.startsAt);
  for (const k of ["description", "link", "venueName", "address", "city", "postalCode", "latitude", "longitude", "imageUrl"])
    assert.ok(!(k in v), k);
  assert.ok(!("isOnline" in v));
  assert.ok(!("groupId" in v));
  const q = render(v.tags);
  assert.match(q.sql, /WHERE true AND/);
});

test("tag SQL handles empty arrays", () => {
  assert.match(render(rescrapeTagsSql([], { slugs: [] })).sql, /ARRAY\[\]::text\[\]/);
  const a = render(appendTagsSql(["hard-tech-week"]));
  assert.deepEqual(a.params, ["hard-tech-week"]);
});
