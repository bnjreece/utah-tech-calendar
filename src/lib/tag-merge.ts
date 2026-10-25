import { sql, type SQL } from "drizzle-orm";
import { events } from "./db/schema";

/* Tag writes that must not lose a tag another writer added in between.
   Both helpers build the new array inside the UPDATE from the row's
   CURRENT tags, so the merge happens under the row lock: when two scrapes
   (or a scrape and the dedup sweep) update the same row at once, the second
   one re-reads the first one's result instead of overwriting it with an
   array computed from a stale SELECT. */

function textArray(xs: readonly string[]): SQL {
  if (xs.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )}]::text[]`;
}

const current = sql`coalesce(${events.tags}, ARRAY[]::text[])`;

/* The row's tags plus `add`, keeping order, without repeats. */
export function appendTagsSql(add: readonly string[]): SQL {
  const a = textArray(add);
  return sql`${current} || ARRAY(SELECT DISTINCT t FROM unnest(${a}) AS t WHERE NOT (t = ANY(${current})))`;
}

/* `next` (the scrape's freshly computed tags), then the row's stored
   classifier suggestions (llm_verdict.suggestedTags) mapped through
   `llmPairs` (suggested spelling -> canonical tag, see
   lib/auto-tag.ts llmTagPairs; a spelling not listed maps to nothing),
   then whichever of the row's current tags `keep` says survive a
   rescrape: the special-week slugs, or every current tag when keepAll is
   set. All three are read inside the UPDATE, so a verdict or week tag
   written by another writer in between is not lost. De-duplicated,
   first occurrence wins. */
export function rescrapeTagsSql(
  next: readonly string[],
  keep: { slugs: Iterable<string>; keepAll?: boolean },
  llmPairs: ReadonlyArray<readonly [string, string]> = [],
): SQL {
  const n = textArray(next);
  const survives = keep.keepAll ? sql`true` : sql`t = ANY(${textArray([...keep.slugs])})`;
  const kept = sql`ARRAY(SELECT t FROM unnest(${current}) AS t WHERE ${survives})`;
  if (llmPairs.length === 0) return dedupe(sql`${n} || ${kept}`);
  const pairs = sql.join(
    llmPairs.map(([f, t]) => sql`(${f}::text, ${t}::text)`),
    sql`, `,
  );
  const suggested = sql`CASE WHEN jsonb_typeof(${events.llmVerdict}->'suggestedTags') = 'array'
    THEN ${events.llmVerdict}->'suggestedTags' ELSE '[]'::jsonb END`;
  const llm = sql`ARRAY(SELECT m.t FROM jsonb_array_elements_text(${suggested}) WITH ORDINALITY AS s(v, o)
    JOIN (VALUES ${pairs}) AS m(f, t) ON m.f = lower(btrim(s.v)) ORDER BY s.o)`;
  return dedupe(sql`${n} || ${llm} || ${kept}`);
}

/* An array without repeats, in first-occurrence order. */
function dedupe(arr: SQL): SQL {
  return sql`ARRAY(SELECT u.t FROM unnest(${arr}) WITH ORDINALITY AS u(t, o) GROUP BY u.t ORDER BY min(u.o))`;
}
