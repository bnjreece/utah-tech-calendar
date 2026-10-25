/* Executes the tag-merge SQL on a real Postgres and checks the resulting
   arrays. Needs a throwaway database: set TAG_MERGE_PG_URL (for example a
   local `initdb` cluster). Skipped otherwise. Creates and drops its own
   temp table named `events`, never touches a real one. */
import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { SQL as BunSQL } from "bun";
import { appendTagsSql, rescrapeTagsSql } from "../tag-merge";
import { rescrapeUpdateValues } from "../rescrape-values";
import { buildEventTags, llmTagPairs } from "../auto-tag";
import { SPECIAL_WEEK_SLUGS } from "../special-weeks";

const url = process.env.TAG_MERGE_PG_URL;
const dialect = new PgDialect();

async function run(stored: string[] | null, llm: unknown, expr: SQL): Promise<string[]> {
  const db = new BunSQL(url!);
  try {
    return await db.begin(async (tx) => {
      await tx.unsafe(`CREATE TEMP TABLE events (id int PRIMARY KEY, tags text[], llm_verdict jsonb) ON COMMIT DROP`);
      await tx.unsafe(`INSERT INTO events VALUES (1, $1::text[], $2::jsonb)`, [stored === null ? null : `{${stored.map((t) => `"${t}"`).join(",")}}`, llm === undefined ? null : JSON.stringify(llm)]);
      const q = dialect.sqlToQuery(expr);
      const rows = await tx.unsafe(`UPDATE events SET tags = ${q.sql} WHERE id = 1 RETURNING tags`, q.params as unknown[]);
      return rows[0].tags as string[];
    });
  } finally {
    await db.close();
  }
}

describe.skipIf(!url)("tag merge on Postgres", () => {
  test("a stored week tag with no fresh hard-tech tag gains hard-tech", async () => {
    const tags = await run(["hard-tech-week"], { suggestedTags: [] }, rescrapeTagsSql(["meetup"], { slugs: SPECIAL_WEEK_SLUGS }, llmTagPairs()));
    expect(tags).toEqual(["meetup", "hard-tech-week", "hard-tech"]);
  });

  test("a partial rescrape drops stale tags, keeps the week tag, maps LLM tags", async () => {
    const fresh = buildEventTags({ title: "Hard Tech Hackathon Kickoff", description: "Sponsored by Snowflake and 47G. Doors 7:00 PM." });
    const v = rescrapeUpdateValues(
      { title: "Hard Tech Hackathon Kickoff", tags: fresh, groupId: "g", isOnline: false },
      { groupLocked: false, onlineLocked: false, partial: true, llmPairs: llmTagPairs() },
    );
    const tags = await run(["data", "aerospace", "product-management", "startup", "hard-tech-week"], { suggestedTags: ["Robotics", "startup"] }, v.tags);
    for (const t of ["data", "aerospace", "product-management", "startup", "founders"]) expect(tags).not.toContain(t);
    expect(tags).toContain("hackathon");
    expect(tags).toContain("hard-tech-week");
    expect(tags).toContain("hard-tech");
    expect(new Set(tags).size).toBe(tags.length);
  });

  test("appending a week tag (dedup carry) brings hard-tech, no repeats", async () => {
    expect(await run(["ai"], null, appendTagsSql(["hard-tech-week"]))).toEqual(["ai", "hard-tech-week", "hard-tech"]);
    expect(await run(["hard-tech-week", "hard-tech"], null, appendTagsSql(["hard-tech-week"]))).toEqual(["hard-tech-week", "hard-tech"]);
    expect(await run(null, null, appendTagsSql(["aerospace"]))).toEqual(["aerospace", "hard-tech"]);
  });
});
