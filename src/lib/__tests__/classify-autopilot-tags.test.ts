/* Astra round 8: classification appends LLM tags before the autopilot runs.
   The autopilot must judge and compare-and-set against the tags as stored
   after that append, or every appended tag makes its guarded write miss and
   the row silently stays pending. The Postgres half needs a throwaway
   database (TAG_MERGE_PG_URL, same as tag-merge-pg.test.ts); skipped
   otherwise. */
import { describe, expect, mock, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { SQL as BunSQL } from "bun";

mock.module("@/lib/db", () => ({
  db: {},
  events: {},
  sources: {},
  pendingSubmissions: {},
  reviewDecisions: {},
  adminSettings: {},
}));

const { rowAfterClassify } = await import("@/lib/classify");
const { appendTagsSql } = await import("@/lib/tag-merge");
const { tagsJson } = await import("@/lib/autopilot-db");

describe("rowAfterClassify", () => {
  test("uses the tags the classify UPDATE stored", () => {
    const r = { id: "x", title: "t", tags: [] as string[] | null };
    expect(rowAfterClassify(r, { tags: ["ai"] }).tags).toEqual(["ai"]);
    expect(rowAfterClassify(r, { tags: null }).tags).toBeNull();
  });
  test("keeps the row as read when nothing was returned", () => {
    const r = { id: "x", title: "t", tags: ["web"] as string[] | null };
    expect(rowAfterClassify(r, undefined)).toBe(r);
  });
  test("does not mutate the row it was given", () => {
    const r = { id: "x", title: "t", tags: [] as string[] | null };
    rowAfterClassify(r, { tags: ["ai"] });
    expect(r.tags).toEqual([]);
  });
});

const url = process.env.TAG_MERGE_PG_URL;
const dialect = new PgDialect();

describe.skipIf(!url)("append then guard, on Postgres", () => {
  test("the guard matches the post-append tags, not the pre-append copy", async () => {
    const db = new BunSQL(url!);
    try {
      await db.begin(async (tx) => {
        await tx.unsafe(`CREATE TEMP TABLE events (id int PRIMARY KEY, tags text[]) ON COMMIT DROP`);
        await tx.unsafe(`INSERT INTO events VALUES (1, '{}'::text[])`);
        const q = dialect.sqlToQuery(appendTagsSql(["ai"]));
        const rows = await tx.unsafe(`UPDATE events SET tags = ${q.sql} WHERE id = 1 RETURNING tags`, q.params as unknown[]);
        const stored = rows[0].tags as string[];
        expect(stored).toContain("ai");
        const guard = (json: string | null) =>
          tx.unsafe(`SELECT count(*)::int AS n FROM events WHERE id = 1 AND to_jsonb(tags) IS NOT DISTINCT FROM $1::text::jsonb`, [json]); // via text: Bun SQL would JSON-encode a string bound straight to jsonb
        const after = rowAfterClassify({ tags: [] as string[] | null }, { tags: stored });
        expect((await guard(tagsJson(after.tags)))[0].n).toBe(1);
        /* The old behavior: guarding on the pre-append [] misses. */
        expect((await guard(tagsJson([])))[0].n).toBe(0);
      });
    } finally {
      await db.close();
    }
  });
});
