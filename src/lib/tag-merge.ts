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

/* `next` (the scrape's freshly computed tags), plus whichever of the row's
   current tags `keep` says survive a rescrape: the special-week slugs, or
   every current tag when keepAll is set. */
export function rescrapeTagsSql(next: readonly string[], keep: { slugs: Iterable<string>; keepAll?: boolean }): SQL {
  const n = textArray(next);
  const survives = keep.keepAll ? sql`true` : sql`t = ANY(${textArray([...keep.slugs])})`;
  return sql`${n} || ARRAY(SELECT DISTINCT t FROM unnest(${current}) AS t WHERE ${survives} AND NOT (t = ANY(${n})))`;
}
