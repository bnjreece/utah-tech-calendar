import type { SQL } from "drizzle-orm";
import { SPECIAL_WEEK_SLUGS } from "./special-weeks";
import { rescrapeTagsSql } from "./tag-merge";

/* The columns an update-on-rescrape writes, from the values a scrape
   computed for the row. Pure (no DB) so the rules are unit tested.
   - groupLocked / onlineLocked: an admin set the group or online flag;
     leave those columns alone.
   - partial: the adapter's detail fetch failed (e.g. rate-limited), so the
     item carries list-level stand-ins: a "Hosted by ..." line for a body, an
     address for a venue, no cover. Refresh its title and times, keep the
     body, link, venue, map pin and cover a full scrape stored earlier, and
     keep every stored tag.
   - tags are merged inside the UPDATE from the row's current tags
     (lib/tag-merge.ts), never written from a value read earlier: the same
     Luma event is scraped by several calendars (the official Hard Tech Week
     calendar injects the week tag, the 47G calendar does not) and the dedup
     sweep adds a week tag to a kept twin. A week tag, once on a row,
     survives every rescrape. The row's stored classifier suggestions
     (llm_verdict.suggestedTags, mapped by opts.llmPairs) are merged in
     the same UPDATE, so classifier tags survive a rescrape too. A column
     left out of the result is not written. */
const KEPT_ON_PARTIAL = [
  "description",
  "link",
  "venueName",
  "address",
  "city",
  "postalCode",
  "latitude",
  "longitude",
  "imageUrl",
] as const;

export function rescrapeUpdateValues<
  T extends { groupId?: unknown; isOnline?: unknown; tags: string[] },
>(
  base: T,
  opts: {
    groupLocked: boolean;
    onlineLocked: boolean;
    partial: boolean;
    llmPairs?: ReadonlyArray<readonly [string, string]>;
  },
): Partial<Omit<T, "tags">> & { tags: SQL } {
  const { groupId, isOnline, tags, ...rest } = base;
  const out: Record<string, unknown> = {
    ...rest,
    tags: rescrapeTagsSql(tags, { slugs: SPECIAL_WEEK_SLUGS, keepAll: opts.partial }, opts.llmPairs),
  };
  if (!opts.groupLocked) out.groupId = groupId;
  if (!opts.onlineLocked && !opts.partial) out.isOnline = isOnline;
  if (opts.partial) for (const k of KEPT_ON_PARTIAL) delete out[k];
  return out as Partial<Omit<T, "tags">> & { tags: SQL };
}
