import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/* Read-side aggregates over the Phase-1 shadow classifier verdicts stored
   on events.llm_verdict. Pure SQL (no AI import) so the admin page bundle
   stays light. Surfaces model-vs-human agreement: the actionable cases are
   "approved but the model flags it" (a spam/off-topic event we're showing)
   and "hidden but the model says tech" (a possible over-hide). */

export type ClassifierStats = {
  classified: number;
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
      count(*)::int AS classified,
      avg((llm_verdict->>'confidence')::float) AS avg_conf,
      count(*) FILTER (
        WHERE status = 'approved'
        AND ((llm_verdict->>'isSpam')::boolean OR NOT (llm_verdict->>'isTechRelevant')::boolean)
      )::int AS approved_flagged,
      count(*) FILTER (
        WHERE status = 'hidden'
        AND (llm_verdict->>'isTechRelevant')::boolean
        AND NOT (llm_verdict->>'isSpam')::boolean
      )::int AS hidden_tech
    FROM events
    WHERE llm_checked_at IS NOT NULL AND starts_at >= now()
  `);
  const agg = rowsOf<AggRow>(aggRes)[0] ?? {
    classified: 0,
    avg_conf: 0,
    approved_flagged: 0,
    hidden_tech: 0,
  };

  const disRes = await db.execute<DisRow>(sql`
    SELECT id, title, status,
      (llm_verdict->>'isTechRelevant')::boolean AS is_tech,
      (llm_verdict->>'isSpam')::boolean AS is_spam,
      (llm_verdict->>'confidence')::float AS confidence,
      coalesce(llm_verdict->>'category', '') AS category
    FROM events
    WHERE llm_checked_at IS NOT NULL AND starts_at >= now()
      AND (
        (status = 'approved' AND ((llm_verdict->>'isSpam')::boolean OR NOT (llm_verdict->>'isTechRelevant')::boolean))
        OR (status = 'hidden' AND (llm_verdict->>'isTechRelevant')::boolean AND NOT (llm_verdict->>'isSpam')::boolean)
      )
    ORDER BY (llm_verdict->>'confidence')::float DESC NULLS LAST
    LIMIT 25
  `);

  return {
    stats: {
      classified: agg.classified ?? 0,
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
