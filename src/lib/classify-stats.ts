import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/* Read-side aggregates over the Phase-1 shadow classifier verdicts stored
   on events.llm_verdict. Pure SQL (no AI import) so the admin page bundle
   stays light. Surfaces model-vs-human agreement: the actionable cases are
   "approved but the model flags it" (a spam/off-topic event we're showing)
   and "hidden but the model says tech" (a possible over-hide).

   Robustness: booleans are compared as raw text ((->>'isSpam') = 'true')
   and the confidence float is cast only behind a numeric-shape regex guard,
   so a malformed verdict (shape drift, manual SQL edit) yields NULL instead
   of throwing a NeonDbError that would 500 the whole health dashboard. The
   page also wraps this call in a fallback as a second line of defense. */

const NUMERIC = "'^[0-9]+([.][0-9]+)?$'";

export type ClassifierStats = {
  /* upcoming classified events - drives the displayed metrics */
  classified: number;
  /* all-time classified count - drives the "configured vs not" empty state
     (so a calendar whose classified events are all past-dated doesn't read
     as "not set up yet"). */
  everClassified: number;
  avgConfidence: number;
  approvedButFlagged: number;
  hiddenButTech: number;
};

export type ClassifierDisagreement = {
  id: string;
  title: string;
  status: string;
  isTechRelevant: boolean;
  isSpam: boolean;
  confidence: number;
  category: string;
};

type AggRow = {
  ever_classified: number;
  classified: number;
  avg_conf: number | null;
  approved_flagged: number;
  hidden_tech: number;
};

type DisRow = {
  id: string;
  title: string;
  status: string;
  is_tech: boolean;
  is_spam: boolean;
  confidence: number | null;
  category: string;
};

function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : (res as { rows?: T[] }).rows ?? []) as T[];
}

export async function getClassifierStats(): Promise<{
  stats: ClassifierStats;
  disagreements: ClassifierDisagreement[];
}> {
  const aggRes = await db.execute<AggRow>(sql`
    SELECT
      count(*)::int AS ever_classified,
      count(*) FILTER (WHERE starts_at >= now())::int AS classified,
      avg(
        CASE WHEN starts_at >= now() AND (llm_verdict->>'confidence') ~ ${sql.raw(NUMERIC)}
          THEN (llm_verdict->>'confidence')::float END
      ) AS avg_conf,
      count(*) FILTER (
        WHERE starts_at >= now() AND status = 'approved'
        AND ((llm_verdict->>'isSpam') = 'true' OR (llm_verdict->>'isTechRelevant') = 'false')
      )::int AS approved_flagged,
      count(*) FILTER (
        WHERE starts_at >= now() AND status = 'hidden'
        AND (llm_verdict->>'isTechRelevant') = 'true'
        AND (llm_verdict->>'isSpam') = 'false'
      )::int AS hidden_tech
    FROM events
    WHERE llm_checked_at IS NOT NULL
  `);
  const agg = rowsOf<AggRow>(aggRes)[0] ?? {
    ever_classified: 0,
    classified: 0,
    avg_conf: 0,
    approved_flagged: 0,
    hidden_tech: 0,
  };

  const disRes = await db.execute<DisRow>(sql`
    SELECT id, title, status,
      ((llm_verdict->>'isTechRelevant') = 'true') AS is_tech,
      ((llm_verdict->>'isSpam') = 'true') AS is_spam,
      CASE WHEN (llm_verdict->>'confidence') ~ ${sql.raw(NUMERIC)}
        THEN (llm_verdict->>'confidence')::float ELSE 0 END AS confidence,
      coalesce(llm_verdict->>'category', '') AS category
    FROM events
    WHERE llm_checked_at IS NOT NULL AND starts_at >= now()
      AND (
        (status = 'approved' AND ((llm_verdict->>'isSpam') = 'true' OR (llm_verdict->>'isTechRelevant') = 'false'))
        OR (status = 'hidden' AND (llm_verdict->>'isTechRelevant') = 'true' AND (llm_verdict->>'isSpam') = 'false')
      )
    ORDER BY (
      CASE WHEN (llm_verdict->>'confidence') ~ ${sql.raw(NUMERIC)}
        THEN (llm_verdict->>'confidence')::float ELSE 0 END
    ) DESC
    LIMIT 25
  `);

  return {
    stats: {
      classified: agg.classified ?? 0,
      everClassified: agg.ever_classified ?? 0,
      avgConfidence: Number(agg.avg_conf ?? 0),
      approvedButFlagged: agg.approved_flagged ?? 0,
      hiddenButTech: agg.hidden_tech ?? 0,
    },
    disagreements: rowsOf<DisRow>(disRes).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      isTechRelevant: r.is_tech,
      isSpam: r.is_spam,
      confidence: Number(r.confidence ?? 0),
      category: r.category,
    })),
  };
}
