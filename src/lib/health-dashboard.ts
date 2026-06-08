import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, sources, scrapeRuns, adminSettings, type Source } from "./db";

/* Data layer for /admin/health. Aggregates the per-source state on
   `sources` with the run history in `scrape_runs` to produce a single
   fleet-status view. Kept out of the page component so the shapes are
   testable and the page stays presentational. */

export type SourceHealthStatus =
  | "ok"
  | "quiet"
  | "stale"
  | "broken"
  | "never"
  | "disabled";

export interface SourceHealth {
  id: string;
  adapter: string;
  url: string;
  host: string;
  enabled: boolean;
  requiresReview: boolean;
  status: SourceHealthStatus;
  lastScrapedAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  /* Last N run outcomes, newest first, for a sparkline-ish dot row. */
  recentRuns: Array<{ status: string; durationMs: number; itemCount: number; startedAt: Date }>;
  /* Rolling stats over the run-history window. */
  errorRate7d: number; // 0..1
  avgDurationMs: number | null;
  runCount7d: number;
}

export interface FleetSummary {
  total: number;
  ok: number;
  quiet: number;
  stale: number;
  broken: number;
  never: number;
  disabled: number;
}

export interface CronHeartbeats {
  lastScrapeTickAt: Date | null;
  lastQueueDigestRunAt: Date | null;
  lastAlertsSentAt: Date | null;
}

/* Freshness threshold. The scrape cron runs every 3h; a source that
   hasn't scraped in 12h is stale regardless of whether it errored. */
const STALE_MS = 12 * 60 * 60 * 1000;

/* A source is "quiet" when it scrapes successfully and fresh but
   has returned 0 events on every one of its recent runs. Distinct
   from broken (errored) and stale (cron not reaching it): the
   adapter works, the group/calendar just has nothing upcoming.
   Surfaced separately so a long run of zeros reads as "maybe dead,
   worth a look" rather than hiding under a green "ok". */
function classify(
  s: Source,
  recentRuns: SourceHealth["recentRuns"],
): SourceHealthStatus {
  if (!s.enabled) return "disabled";
  if (s.lastError) return "broken";
  if (!s.lastScrapedAt) return "never";
  const sinceMs = Date.now() - new Date(s.lastScrapedAt).getTime();
  if (sinceMs > STALE_MS) return "stale";
  /* Need at least 3 runs of history before calling it quiet, so a
     brand-new source mid-first-scrape doesn't flash quiet. */
  if (recentRuns.length >= 3 && recentRuns.every((r) => r.itemCount === 0)) {
    return "quiet";
  }
  return "ok";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown-host";
  }
}

export async function fetchSourceHealth(): Promise<{
  sources: SourceHealth[];
  summary: FleetSummary;
  heartbeats: CronHeartbeats;
}> {
  const sourceRows = await db.select().from(sources);

  /* Pull the last 8 runs per source for the dot row. A single query
     with a window function keeps this to one round-trip. */
  const recentRunsRows = await db.execute<{
    source_id: string;
    status: string;
    duration_ms: number;
    item_count: number;
    started_at: string;
    rn: number;
  }>(sql`
    SELECT source_id, status, duration_ms, item_count, started_at, rn
    FROM (
      SELECT source_id, status, duration_ms, item_count, started_at,
             row_number() OVER (PARTITION BY source_id ORDER BY started_at DESC) AS rn
      FROM scrape_runs
    ) ranked
    WHERE rn <= 8
    ORDER BY source_id, started_at DESC
  `);
  const recentRunsList = (Array.isArray(recentRunsRows) ? recentRunsRows : recentRunsRows.rows ?? []) as Array<{
    source_id: string;
    status: string;
    duration_ms: number;
    item_count: number;
    started_at: string;
  }>;
  const recentBySource = new Map<string, SourceHealth["recentRuns"]>();
  for (const r of recentRunsList) {
    const list = recentBySource.get(r.source_id) ?? [];
    list.push({
      status: r.status,
      durationMs: r.duration_ms,
      itemCount: r.item_count,
      startedAt: new Date(r.started_at),
    });
    recentBySource.set(r.source_id, list);
  }

  /* 7-day rolling stats per source: error rate + avg duration. */
  const statsRows = await db
    .select({
      sourceId: scrapeRuns.sourceId,
      total: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) FILTER (WHERE ${scrapeRuns.status} = 'error')::int`,
      avgMs: sql<number>`coalesce(avg(${scrapeRuns.durationMs}), 0)::int`,
    })
    .from(scrapeRuns)
    .where(gte(scrapeRuns.startedAt, sql`now() - interval '7 days'`))
    .groupBy(scrapeRuns.sourceId);
  const statsBySource = new Map(statsRows.map((r) => [r.sourceId, r]));

  const summary: FleetSummary = {
    total: sourceRows.length,
    ok: 0,
    quiet: 0,
    stale: 0,
    broken: 0,
    never: 0,
    disabled: 0,
  };

  const healthList: SourceHealth[] = sourceRows.map((s) => {
    const recentRuns = recentBySource.get(s.id) ?? [];
    const status = classify(s, recentRuns);
    summary[status]++;
    const stats = statsBySource.get(s.id);
    return {
      id: s.id,
      adapter: s.adapter,
      url: s.url,
      host: hostOf(s.url),
      enabled: s.enabled,
      requiresReview: s.requiresReview,
      status,
      lastScrapedAt: s.lastScrapedAt ? new Date(s.lastScrapedAt) : null,
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      recentRuns,
      errorRate7d: stats && stats.total > 0 ? stats.errors / stats.total : 0,
      avgDurationMs: stats ? stats.avgMs : null,
      runCount7d: stats?.total ?? 0,
    };
  });

  /* Sort: broken first (need attention), then stale, never, quiet,
     ok, disabled last. Within a status, worst error-rate first. */
  const order: Record<SourceHealthStatus, number> = {
    broken: 0,
    stale: 1,
    never: 2,
    quiet: 3,
    ok: 4,
    disabled: 5,
  };
  healthList.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return b.errorRate7d - a.errorRate7d;
  });

  const [settings] = await db.select().from(adminSettings).limit(1);
  const heartbeats: CronHeartbeats = {
    lastScrapeTickAt: settings?.lastScrapeTickAt ? new Date(settings.lastScrapeTickAt) : null,
    lastQueueDigestRunAt: settings?.lastQueueDigestRunAt
      ? new Date(settings.lastQueueDigestRunAt)
      : null,
    lastAlertsSentAt: settings?.lastAlertsSentAt ? new Date(settings.lastAlertsSentAt) : null,
  };

  return { sources: healthList, summary, heartbeats };
}

/* Recent errors across the whole fleet, newest first. Powers the
   "what broke recently" feed at the bottom of the dashboard. */
export async function fetchRecentErrors(limit = 20): Promise<
  Array<{ adapter: string; host: string; error: string; startedAt: Date; url: string }>
> {
  const rows = await db
    .select({
      adapter: scrapeRuns.adapter,
      error: scrapeRuns.error,
      startedAt: scrapeRuns.startedAt,
      url: sources.url,
    })
    .from(scrapeRuns)
    .leftJoin(sources, eq(scrapeRuns.sourceId, sources.id))
    .where(and(eq(scrapeRuns.status, "error")))
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(limit);
  return rows.map((r) => ({
    adapter: r.adapter,
    host: r.url ? hostOf(r.url) : "unknown",
    error: r.error ?? "(no message)",
    startedAt: new Date(r.startedAt),
    url: r.url ?? "",
  }));
}