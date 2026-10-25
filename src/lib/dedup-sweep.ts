import { db, events } from "./db";
import { sql, inArray, and, eq, gte } from "drizzle-orm";
import { recordEventDecision } from "./review-log";
import { findSameDayTwins } from "./same-day-twins";
import { appendTagsSql } from "./tag-merge";
import { planTagCarries } from "./dedup-tag-carry";
import { planQueueTwinHides } from "./queue-twins";
import { applyQueueTwinHide } from "./autopilot-db";

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

   4. Same-day twins (lib/same-day-twins.ts): same normalized title, same
      Denver day, starts within 90 minutes, across sources, AND identity
      evidence (same link, same venue, or a Luma calendar's external
      listing at the same minute). Catches one event listed on two
      calendars or sources. Keeps a locked row, then a row still being
      refreshed by scrapes, then the oldest; locked rows are never hidden.
      The kept row inherits any special-week tag (Hard Tech Week) a hidden
      twin carried, so the event stays in that week's filtered view.

   5. Queue twins (lib/queue-twins.ts): a PENDING row that duplicates an
      upcoming approved row, or another pending row, on the same Denver
      day, by strict evidence only: the same upstream listing id (Eventbrite,
      Meetup or Luma event) from one source. Hidden as 'cross-post' and
      ledgered by the autopilot ('autopilot:queue-dup'); runs only while
      the LLM gate is on.

   Keeps the OLDEST event in each of clusters 1-3 as canonical; hides the rest.
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

  /* Cluster 4: same-day twins. Upcoming approved rows only - a past twin
     no longer shows anywhere that matters. */
  const now = new Date();
  const upcoming = await db
    .select({
      id: events.id,
      title: events.title,
      source: events.source,
      externalId: events.externalId,
      link: events.link,
      venueName: events.venueName,
      latitude: events.latitude,
      longitude: events.longitude,
      startsAt: events.startsAt,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      statusLocked: events.statusLocked,
    })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, now)));
  /* Run on what clusters 1-3 left visible, so a twin is never kept that
     one of them is about to hide. */
  const twinClusters = findSameDayTwins(
    upcoming.filter((r) => !toHide.has(r.id)),
    now,
  );
  for (const c of twinClusters) {
    for (const r of c.drop) toHide.add(r.id);
    details.push({
      signature: `twin:${c.key}`,
      source: c.keep.source,
      kept: c.keep.title,
      hiddenCount: c.drop.length,
    });
  }

  /* Carry week tags to the surviving rows BEFORE hiding their twins, as
     one atomic array merge each (a concurrent scrape rewriting tags cannot
     drop it, see lib/tag-merge.ts). Covers every cluster, so a tagged row
     hidden by an exact-title cluster hands its tag on too. If the hide
     below then fails, the tag is on both rows, which is harmless. */
  const clusterIds = [...clusters.map((c) => c.ids), ...twinClusters.map((c) => [c.keep.id, ...c.drop.map((r) => r.id)])];
  if (toHide.size > 0) {
    const involved = [...new Set(clusterIds.flat())];
    const tagRows = await db.select({ id: events.id, tags: events.tags }).from(events).where(inArray(events.id, involved));
    const carries = planTagCarries(clusterIds, toHide, new Map(tagRows.map((r) => [r.id, r.tags])));
    for (const [id, add] of carries) {
      await db.update(events).set({ tags: appendTagsSql(add) }).where(eq(events.id, id));
    }
  }

  if (toHide.size > 0) {
    const ids = [...toHide];
    /* Snapshot the rows BEFORE hiding (all are status='approved' here, since
       every cluster query filters status='approved') so the ledger records
       an accurate approved -> hidden transition. */
    const before = await db.select().from(events).where(inArray(events.id, ids));
    await db
      .update(events)
      .set({ status: "hidden", hiddenReason: "cross-post" })
      .where(inArray(events.id, ids));
    /* Log each programmatic hide to the moderation ledger (channel 'auto')
       so the self-healing funnel + per-adapter quality rollups see cross-
       post hides, not just human decisions. Best-effort - recordEventDecision
       swallows its own errors and never throws. */
    for (const row of before) {
      await recordEventDecision(row, "hide", {
        newStatus: "hidden",
        reason: "cross-post",
        decidedBy: "system",
        channel: "auto",
      });
    }
  }

  /* Cluster 5: queue twins. After the approved hides above, so a pending
     row never defers to an approved row that was just hidden. Best-effort:
     a failure leaves the rows pending for a human. */
  let queueHidden = 0;
  try {
    const sweptAt = new Date();
    const live = await db
      .select()
      .from(events)
      .where(and(inArray(events.status, ["pending", "approved"]), gte(events.startsAt, sweptAt)));
    const plan = planQueueTwinHides(live, sweptAt);
    for (const h of plan) {
      const row = live.find((r) => r.id === h.hide.id);
      const keep = live.find((r) => r.id === h.keep.id);
      if (!row || !keep) continue;
      /* One failed hide (a lock timeout, say) leaves that row pending and
         does not stop the rest of the plan. */
      try {
        if (await applyQueueTwinHide(row, keep)) {
          queueHidden++;
          details.push({ signature: `queue-twin:listing`, source: h.keep.source, kept: h.keep.title, hiddenCount: 1 });
        }
      } catch (err) {
        console.warn("[dedup] queue twin hide failed", row.id, err);
      }
    }
  } catch (err) {
    console.warn("[dedup] queue twin sweep failed", err);
  }

  return {
    clustersFound: clusters.length + twinClusters.length + queueHidden,
    eventsHidden: toHide.size + queueHidden,
    details,
  };
}
