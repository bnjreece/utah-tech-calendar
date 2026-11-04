import { cache } from "react";
import { unstable_cache } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db, events, groups, sources } from "./db";
import { REFILL_TIMEOUT_MS } from "./public-data-timing";
import { guardedLoader } from "./refill-guard";
import {
  decodePublicPayload,
  encodePublicPayload,
  isReduced,
  payloadStoredBytes,
  PublicDataTooLargeError,
  PUBLIC_DATA_LIMIT_BYTES,
  PUBLIC_DATA_TAG,
  PUBLIC_DATA_WARN_BYTES,
  PUBLIC_EVENT_FIELDS,
  PUBLIC_GROUP_FIELDS,
  PUBLIC_PAYLOAD_VERSION,
  type PayloadReductions,
  type PublicData,
  type PublicPayload,
} from "./public-events";

/* The one shared, cached copy of the public data. Every public page reads
   it (through lib/queries.ts), so between data changes the database is
   not touched at all and Neon can suspend.

   Refilled when the PUBLIC_DATA_TAG tag is marked stale (crons, admin
   actions, the moderation link) or after the 6 h safety TTL. A refill is
   3 queries and runs on the first page view after an invalidation. It
   is held to REFILL_TIMEOUT_MS (lib/public-data-timing.ts), which the
   delayed second invalidation depends on. */

function pickColumns<T extends object, K extends keyof T>(table: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = table[k];
  return out;
}

/* The three refill queries. Built once; `.toSQL()` is pure (no database
   call) and goes into the cache key below. */
const eventsQuery = () =>
  db
    .select(pickColumns(events, PUBLIC_EVENT_FIELDS))
    .from(events)
    .where(eq(events.status, "approved"))
    .orderBy(asc(events.startsAt), asc(events.id));
const groupsQuery = () => db.select(pickColumns(groups, PUBLIC_GROUP_FIELDS)).from(groups);
const sourcesQuery = () =>
  db.select({ n: sql<number>`count(*)::int` }).from(sources).where(eq(sources.enabled, true));

async function loadPublicPayload(): Promise<PublicPayload> {
  const [eventRows, groupRows, sourceRows] = await Promise.all([eventsQuery(), groupsQuery(), sourcesQuery()]);
  /* generatedAt is a label for logs and the decode memo, and the `now`
     that decides which events count as past when the entry has to be
     cut down to fit. Pages never filter on it. */
  let payload: PublicPayload;
  try {
    payload = encodePublicPayload(
      { events: eventRows, groups: groupRows, enabledSourceCount: sourceRows[0]?.n ?? 0 },
      new Date(),
    );
  } catch (err) {
    if (err instanceof PublicDataTooLargeError) {
      console.error(
        `[public-data] refill refused: entry would be ${err.bytes} bytes after every reduction ` +
          `(max ${err.maxBytes}, ${JSON.stringify(err.reduced)}). Serving the stale entry. Split the dataset.`,
      );
    }
    throw err;
  }
  const bytes = payloadStoredBytes(payload);
  const reduced = isReduced(payload.reduced) ? ` reduced=${JSON.stringify(payload.reduced)}` : "";
  console.log(
    `[public-data] refill events=${eventRows.length} stored=${payload.count} groups=${groupRows.length} gz=${bytes}${reduced}`,
  );
  if (bytes > PUBLIC_DATA_WARN_BYTES || isReduced(payload.reduced)) {
    console.error(
      `[public-data] cached entry is ${bytes} bytes (limit ${PUBLIC_DATA_LIMIT_BYTES}), ` +
        `cut to fit: ${JSON.stringify(payload.reduced)}. Split or bound the dataset.`,
    );
  }
  return payload;
}

/* Time limit, backoff and one shared load per instance; see
   lib/refill-guard.ts. A refill that takes longer than REFILL_TIMEOUT_MS
   fails, stores nothing, and the stale entry keeps being served. */
const loadPublicPayloadOnce = guardedLoader(loadPublicPayload, {
  timeoutMs: REFILL_TIMEOUT_MS,
  label: "[public-data] refill",
  onFailure: (failures, wait, err) => {
    console.error(
      `[public-data] refill failed (${failures} in a row); next try in ${Math.round(wait / 1000)} s`,
      err,
    );
  },
});

/* unstable_cache keys on the callback's source text. The bundler copies
   this module into several chunks with different minified names, so the
   raw function would get one cache entry (and one refill) per chunk. A
   fixed toString gives every route the same entry. The SQL text of the
   three queries (field lists, WHERE, ORDER) is in the key, so a deploy
   that changes a query starts a fresh entry instead of serving one
   written by the old query; bump PUBLIC_PAYLOAD_VERSION for any other
   payload change. */
const loader = Object.assign(() => loadPublicPayloadOnce(), {
  toString: () => "public-data-loader",
});

const getCachedPayload = unstable_cache(
  loader,
  [
    "public-data",
    `v${PUBLIC_PAYLOAD_VERSION}`,
    eventsQuery().toSQL().sql,
    groupsQuery().toSQL().sql,
    sourcesQuery().toSQL().sql,
  ],
  { tags: [PUBLIC_DATA_TAG], revalidate: 21600 },
);

/* cache(): generateMetadata and the page share one decode per render. */
export const getPublicData = cache(
  async (): Promise<PublicData> => decodePublicPayload(await getCachedPayload()),
);

export interface PublicDataStats {
  generatedAt: Date;
  events: number;
  bytes: number;
  reduced: PayloadReductions;
}

/* Size of the cached entry, for /admin/health and the health-alerts cron.
   Reads the data cache like any page (a refill only if it is stale). */
export async function getPublicDataStats(): Promise<PublicDataStats> {
  const p = await getCachedPayload();
  return {
    generatedAt: new Date(p.generatedAt),
    events: p.count,
    bytes: payloadStoredBytes(p),
    reduced: p.reduced,
  };
}

export { PUBLIC_DATA_TAG };
