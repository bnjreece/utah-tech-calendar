import { db, events } from "./db";
import { sql, eq, inArray } from "drizzle-orm";

export interface DedupResult {
  clustersFound: number;
  eventsHidden: number;
  eventsRestored: number;
  details: Array<{ titlePrefix: string; source: string; kept: string; hidden: string[] }>;
}

/* Detects cross-posted SEO-spam clusters: 3+ events from the same source
   that share a 30-char normalized title prefix AND the same start_at.
   Pattern: training companies list the same workshop per city to dominate
   local search. Heuristic: keep the OLDEST event in the cluster as the
   canonical (status=approved), set the others to status='hidden'.

   Idempotent: re-running after the cluster shrinks restores hidden events
   when the cluster falls below the 3-event threshold. Safe to run after
   every scrape. */
export async function sweepCrossPostDuplicates(): Promise<DedupResult> {
  // Find all clusters of 3+ events (approved OR hidden) with the same
  // source + start_at + 30-char normalized title prefix.
  const clusterRows = await db.execute(sql`
    SELECT
      substring(lower(regexp_replace(title, '[^a-z0-9 ]', '', 'gi')) from 1 for 30) AS prefix,
      source,
      starts_at,
      array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
      array_agg(status ORDER BY created_at ASC, id ASC) AS statuses,
      array_agg(title ORDER BY created_at ASC, id ASC) AS titles
    FROM events
    WHERE status IN ('approved', 'hidden')
      AND external_id IS NOT NULL
      AND title IS NOT NULL
      AND starts_at IS NOT NULL
    GROUP BY prefix, source, starts_at
    HAVING COUNT(*) >= 3
  `);
  const clusters = (Array.isArray(clusterRows)
    ? clusterRows
    : (clusterRows.rows ?? [])) as Array<{
    prefix: string;
    source: string;
    ids: string[];
    statuses: string[];
    titles: string[];
  }>;

  const toHide: string[] = [];
  const toRestore: string[] = [];
  const details: DedupResult["details"] = [];

  for (const c of clusters) {
    const [keepId, ...dropIds] = c.ids;
    const [keepStatus, ...dropStatuses] = c.statuses;
    const [keepTitle] = c.titles;

    // Keep the oldest as approved
    if (keepStatus !== "approved") toRestore.push(keepId);

    // Hide the rest
    for (let i = 0; i < dropIds.length; i++) {
      if (dropStatuses[i] !== "hidden") toHide.push(dropIds[i]);
    }

    details.push({
      titlePrefix: c.prefix,
      source: c.source,
      kept: keepTitle,
      hidden: dropIds,
    });
  }

  // Also restore events that WERE hidden by a previous sweep but are no
  // longer in a 3+ cluster (cluster shrunk below threshold).
  const allClusteredIds = clusters.flatMap((c) => c.ids);
  const orphanedHidden = await db.execute(sql`
    SELECT id, title FROM events
    WHERE status = 'hidden'
      ${
        allClusteredIds.length > 0
          ? sql`AND id NOT IN (${sql.join(
              allClusteredIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : sql``
      }
  `);
  const orphanRows = (Array.isArray(orphanedHidden)
    ? orphanedHidden
    : (orphanedHidden.rows ?? [])) as Array<{ id: string; title: string }>;
  for (const row of orphanRows) toRestore.push(row.id);

  // Apply
  if (toHide.length > 0) {
    await db
      .update(events)
      .set({ status: "hidden" })
      .where(inArray(events.id, toHide));
  }
  if (toRestore.length > 0) {
    await db
      .update(events)
      .set({ status: "approved" })
      .where(inArray(events.id, toRestore));
  }

  return {
    clustersFound: clusters.length,
    eventsHidden: toHide.length,
    eventsRestored: toRestore.length,
    details,
  };
}
