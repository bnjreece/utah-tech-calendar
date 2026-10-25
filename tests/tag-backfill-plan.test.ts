import assert from "node:assert/strict";
import { test } from "node:test";
import { newTagsFor } from "../scripts/tag-backfill-plan";

const row = (over: Partial<Parameters<typeof newTagsFor>[0]>) => ({
  id: "00000000-0000-0000-0000-000000000001",
  title: "Vibe Code Club for Entrepreneurs",
  description: "Build an app in an evening.",
  tags: ["hard-tech-week"],
  source: "luma",
  starts_at: "2026-11-20T01:00:00.000Z",
  is_online: false,
  is_past: true,
  stale: true,
  llm: [],
  source_default_tags: null,
  source_cfg_tags: null,
  ...over,
});

test("planner: a stored week tag with nothing else hard-tech still gets the hard-tech umbrella", () => {
  const out = newTagsFor(row({}));
  assert.ok(out.includes("hard-tech-week"), out.join());
  assert.ok(out.includes("hard-tech"), out.join());
  assert.ok(out.indexOf("hard-tech") > out.indexOf("hard-tech-week"));
});

test("planner: a stale non-week tag on a scraped row is recomputed away", () => {
  const out = newTagsFor(row({ title: "Opening Party", description: "Sponsored by Snowflake and 47G.", tags: ["data", "aerospace", "product-management"] }));
  for (const t of ["data", "aerospace", "product-management", "hard-tech"]) assert.ok(!out.includes(t), `${t} in ${out.join()}`);
});
