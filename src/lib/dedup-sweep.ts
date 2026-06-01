import { db, events } from "./db";
import { sql, inArray } from "drizzle-orm";

export interface DedupResult {
  clustersFound: number;
  eventsHidden: number;
  details: Array<{ signature: string; source: string; kept: string; hiddenCount: number }>;
}

/* Detect cross-posted SEO-spam clusters and hide all but one canonical entry.
   Three heuristics, unioned:

   1. Same source + same start_at + IDENTICAL title, 2+ entries. Catches
      true double-listings where an organizer posted the same event twice
      under different venue addresses.

   2. Same source + same start_at + same 30-char normalized title PREFIX,
      3+ entries. Catches training companies posting one event per city.

   3. Same source + same start_at + same venue + 4+ entries with differing
      titles. Catches networking-style organizers who post the same time slot
      under many topic angles ("Tech and Business Networking - SLC",
      "Real Estate and Business Networking - SLC", etc). Threshold of 4
      avoids eating 3-track conferences at one room.

   Keeps the OLDEST event in each cluster as canonical; hides the rest.
   Hide-only by design - manual restore happens via /admin/hidden. */
export async function sweepCrossPostDuplicates(): Promise<DedupResult> {
  /* Cluster A: identical title, threshold 2. Strictest signal - almost
     zero false-positive risk. */
  const exactRows = await db.execute(sql`
    SELECT
      'exact:' || title AS signature,
      source,
      array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
      array_agg(title ORDER BY created_at ASC, id ASC) AS titles
    FROM events
    WHERE status = 'approved'
      AND external_id IS NOT NULL
      AND title IS NOT NULL
      AND starts_at IS NOT NULL
    GROUP BY signature, source, starts_at
    HAVING COUNT(*) >= 2
  `);

  // Cluster B: title-prefix
  const prefixRows = await db.execute(sql`
    SELECT
      'prefix:' || substring(lower(regexp_replace(title, '[^a-z0-9 ]', '', 'gi')) from 1 for 30) AS signature,
      source,
      array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
      array_agg(title ORDER BY created_at ASC, id ASC) AS titles
    FROM events
    WHERE status = 'approved'
      AND external_id IS NOT NULL
      AND title IS NOT NULL
      AND starts_at IS NOT NULL
    GROUP BY signature, source, starts_at
    HAVING COUNT(*) >= 3
  `);

  /* Cluster B: same venue + start_at, differing titles. Threshold is 4
     (not 3) so a 3-track conference - "Track A", "Track B", "Track C"
     at the same room and start time - is NOT eaten by the sweep. 4+
     distinct titles at the same source/time/venue is the SEO-spam
     signature. */
  const venueRows = await db.execute(sql`
    SELECT
      'venue:' || lower(trim(venue_name)) AS signature,
      source,
      array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
      array_agg(title ORDER BY created_at ASC, id ASC) AS titles
    FROM events
    WHERE status = 'approved'
      AND external_id IS NOT NULL
      AND title IS NOT NULL
      AND starts_at IS NOT NULL
      AND venue_name IS NOT NULL
      AND trim(venue_name) <> ''
    GROUP BY signature, source, starts_at
    HAVING COUNT(DISTINCT title) >= 4
  `);

  type Cluster = { signature: string; source: string; ids: string[]; titles: string[] };
  const exactClusters = (Array.isArray(exactRows) ? exactRows : (exactRows.rows ?? [])) as Cluster[];
  const prefixClusters = (Array.isArray(prefixRows) ? prefixRows : (prefixRows.rows ?? [])) as Cluster[];
  const venueClusters = (Array.isArray(venueRows) ? venueRows : (venueRows.rows ?? [])) as Cluster[];
  const clusters = [...exactClusters, ...prefixClusters, ...venueClusters];

  const toHide = new Set<string>();
  const details: DedupResult["details"] = [];

  for (const c of clusters) {
    const [, ...dropIds] = c.ids;
    const [keepTitle] = c.titles;
    for (const id of dropIds) toHide.add(id);
    details.push({
      signature: c.signature,
      source: c.source,
      kept: keepTitle,
      hiddenCount: dropIds.length,
    });
  }

  if (toHide.size > 0) {
    await db
      .update(events)
      .set({ status: "hidden", hiddenReason: "cross-post" })
      .where(inArray(events.id, [...toHide]));
  }

  return {
    clustersFound: clusters.length,
    eventsHidden: toHide.size,
    details,
  };
}
