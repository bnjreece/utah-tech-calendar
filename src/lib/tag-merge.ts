import { sql, type SQL } from "drizzle-orm";
import { events } from "./db/schema";
import { tagImplicationPairs } from "./auto-tag";

/* Tag writes that must not lose a tag another writer added in between.
   Both helpers build the new array inside the UPDATE from the row's
   CURRENT tags, so the merge happens under the row lock: when two scrapes
   (or a scrape and the dedup sweep) update the same row at once, the second
   one re-reads the first one's result instead of overwriting it with an
   array computed from a stale SELECT.

   Both finish with the tag implications (lib/auto-tag.ts TAG_IMPLIES:
   aerospace and hard-tech-week bring hard-tech) applied to the WHOLE
   merged array, so a week tag retained from the row, or carried over by
   the dedup sweep, still brings its umbrella tag. */

function textArray(xs: readonly string[]): SQL {
  if (xs.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )}]::text[]`;
}

const current = sql`coalesce(${events.tags}, ARRAY[]::text[])`;

/* `arr` plus every tag a member of it implies and it lacks, appended in
   implication order. `arr` must already be free of repeats. */
export function withImplicationsSql(arr: SQL): SQL {
  const pairs = tagImplicationPairs();
  if (pairs.length === 0) return arr;
  const values = sql.join(
    pairs.map(([f, t], i) => sql`(${f}::text, ${t}::text, ${i}::int)`),
    sql`, `,
  );
  return sql`(SELECT x.a || ARRAY(
      SELECT m.t FROM (VALUES ${values}) AS m(f, t, o)
       WHERE m.f = ANY(x.a) AND NOT (m.t = ANY(x.a))
       GROUP BY m.t ORDER BY min(m.o))
    FROM (SELECT ${arr} AS a) AS x)`;
}

/* The row's tags plus `add`, keeping order, without repeats, then
   implications. */
export function appendTagsSql(add: readonly string[]): SQL {
  const a = textArray(add);
  return withImplicationsSql(
    sql`${current} || ARRAY(SELECT DISTINCT t FROM unnest(${a}) AS t WHERE NOT (t = ANY(${current})))`,
  );
}

/* `next` (the scrape's freshly computed tags), then the row's stored
   classifier suggestions (llm_verdict.suggestedTags) mapped through
   `llmPairs` (suggested spelling -> canonical tag, see
   lib/auto-tag.ts llmTagPairs; a spelling not listed maps to nothing),
   then the row's current special-week tags (`keep.slugs`), which survive
   every rescrape. All three are read inside the UPDATE, so a verdict or
   week tag written by another writer in between is not lost.
   De-duplicated, first occurrence wins, then implications. Every other
   stored tag is dropped: `next` recomputes it from the event's text, so a
   tag from a retired rule or an old spelling does not live on. */
export function rescrapeTagsSql(
  next: readonly string[],
  keep: { slugs: Iterable<string> },
  llmPairs: ReadonlyArray<readonly [string, string]> = [],
): SQL {
  const n = textArray(next);
  const kept = sql`ARRAY(SELECT t FROM unnest(${current}) AS t WHERE t = ANY(${textArray([...keep.slugs])}))`;
  if (llmPairs.length === 0) return withImplicationsSql(dedupe(sql`${n} || ${kept}`));
  const pairs = sql.join(
    llmPairs.map(([f, t]) => sql`(${f}::text, ${t}::text)`),
    sql`, `,
  );
  const suggested = sql`CASE WHEN jsonb_typeof(${events.llmVerdict}->'suggestedTags') = 'array'
    THEN ${events.llmVerdict}->'suggestedTags' ELSE '[]'::jsonb END`;
  const llm = sql`ARRAY(SELECT m.t FROM jsonb_array_elements_text(${suggested}) WITH ORDINALITY AS s(v, o)
    JOIN (VALUES ${pairs}) AS m(f, t) ON m.f = lower(btrim(s.v)) ORDER BY s.o)`;
  return withImplicationsSql(dedupe(sql`${n} || ${llm} || ${kept}`));
}

/* An array without repeats, in first-occurrence order. */
function dedupe(arr: SQL): SQL {
  return sql`ARRAY(SELECT u.t FROM unnest(${arr}) WITH ORDINALITY AS u(t, o) GROUP BY u.t ORDER BY min(u.o))`;
}
