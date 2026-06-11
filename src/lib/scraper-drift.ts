import { sql } from "drizzle-orm";
import { db } from "./db";

/* Silent-drift detection.
 *
 * The /admin/health "broken" status only fires when a source ERRORS
 * (lastError set). But when a site like Meetup restructures its HTML/
 * JSON, our parser often returns an empty list with NO error - the
 * source just goes "quiet". A single quiet source is usually just a
 * group with nothing upcoming, so we can't act on it. But real drift
 * breaks EVERY source sharing an adapter at once (one Meetup change ->
 * all Meetup sources crater together). That collective signal is what
 * we detect here: an adapter where a meaningful share of its sources
 * were producing events within the last ~30 days but have dropped to
 * zero in the last few days. This is exactly the failure mode that
 * repeatedly took the predecessor (utahdev.events) offline silently. */

export interface DriftedAdapter {
  adapter: string;
  sourcesWithHistory: number;
  regressedCount: number;
  /* A sample of the regressed source URLs, for the fixer's context. */
  regressedUrls: string[];
}

/* An adapter is "drifted" only if at least this fraction of its
   history-having sources regressed AND at least 2 did - so one group
   going quiet never trips it, but a site-wide structure change does. */
const REGRESSION_FRACTION = 0.4;
const MIN_REGRESSED = 2;

type Row = {
  adapter: string;
  sources_with_history: number;
  regressed_count: number;
  regressed_urls: string[] | null;
};

export async function fetchDriftedAdapters(): Promise<DriftedAdapter[]> {
  const result = await db.execute<Row>(sql`
    WITH per_source AS (
      SELECT
        sr.adapter,
        s.url,
        MAX(sr.item_count) FILTER (
          WHERE sr.started_at >= now() - interval '30 days'
            AND sr.started_at <  now() - interval '3 days'
        ) AS hist_max,
        MAX(sr.item_count) FILTER (WHERE sr.started_at >= now() - interval '3 days') AS recent_max,
        COUNT(*) FILTER (WHERE sr.started_at >= now() - interval '3 days') AS recent_runs
      FROM scrape_runs sr
      JOIN sources s ON s.id = sr.source_id
      WHERE s.enabled = true AND s.last_error IS NULL
      GROUP BY sr.adapter, s.url
    ),
    flagged AS (
      SELECT
        adapter,
        url,
        (COALESCE(hist_max, 0) > 0) AS had_history,
        (COALESCE(hist_max, 0) > 0 AND COALESCE(recent_max, 0) = 0 AND recent_runs >= 1) AS regressed
      FROM per_source
    )
    SELECT
      adapter,
      COUNT(*) FILTER (WHERE had_history)::int AS sources_with_history,
      COUNT(*) FILTER (WHERE regressed)::int AS regressed_count,
      array_agg(url) FILTER (WHERE regressed) AS regressed_urls
    FROM flagged
    GROUP BY adapter
    HAVING COUNT(*) FILTER (WHERE regressed) >= ${MIN_REGRESSED}
    ORDER BY regressed_count DESC
  `);

  const rows = (Array.isArray(result) ? result : result.rows ?? []) as Row[];

  return rows
    .filter(
      (r) =>
        r.sources_with_history > 0 &&
        r.regressed_count / r.sources_with_history >= REGRESSION_FRACTION,
    )
    .map((r) => ({
      adapter: r.adapter,
      sourcesWithHistory: r.sources_with_history,
      regressedCount: r.regressed_count,
      regressedUrls: (r.regressed_urls ?? []).slice(0, 8),
    }));
}
