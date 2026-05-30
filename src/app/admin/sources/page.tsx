import { asc, sql, eq } from "drizzle-orm";
import { db, sources, events } from "@/lib/db";
import {
  toggleSourceEnabled,
  toggleSourceRequiresReview,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function SourcesAdminPage() {
  const rows = await db.select().from(sources).orderBy(asc(sources.adapter), asc(sources.url));

  // Per-source event counts (approved + pending + hidden, upcoming only)
  const counts = await db.execute(sql`
    SELECT source, status, COUNT(*)::int as c
    FROM events
    WHERE starts_at >= now()
    GROUP BY source, status
  `);
  const countRows = (Array.isArray(counts) ? counts : (counts.rows ?? [])) as Array<{ source: string; status: string; c: number }>;
  const countMap = new Map<string, { approved: number; pending: number; hidden: number }>();
  for (const r of countRows) {
    const k = r.source;
    const existing = countMap.get(k) ?? { approved: 0, pending: 0, hidden: 0 };
    if (r.status === "approved") existing.approved = r.c;
    if (r.status === "pending") existing.pending = r.c;
    if (r.status === "hidden") existing.hidden = r.c;
    countMap.set(k, existing);
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-4">
        {rows.length} sources
      </p>
      <p className="text-sm text-ink-soft max-w-[60ch] text-pretty mb-8">
        Toggle <em>enabled</em> to control whether the cron scrapes this source.
        Toggle <em>requires review</em> for broad/generic sources so new events
        land in the review queue instead of going live.
      </p>
      <ul role="list" className="flex flex-col">
        {rows.map((s) => {
          const c = countMap.get(s.adapter);
          const lastScraped = s.lastScrapedAt
            ? new Date(s.lastScrapedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            : "never";
          return (
            <li
              key={s.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 py-5 border-t border-ink/15 first:border-t-0 items-baseline"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <span>{s.adapter}</span>
                  <span aria-hidden>·</span>
                  <span>last scraped {lastScraped}</span>
                  {s.lastStatus && (<><span aria-hidden>·</span><span>{s.lastStatus}</span></>)}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 font-display text-base text-ink hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors break-all"
                >
                  {s.url}
                </a>
                {s.lastError && (
                  <p className="mt-1 text-xs text-sunset-deep">{s.lastError.slice(0, 200)}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                <form action={toggleSourceEnabled.bind(null, s.id, !s.enabled)}>
                  <button
                    type="submit"
                    className={`py-1.5 sm:py-0 ${s.enabled ? "text-ink hover:text-sunset-deep hover:underline decoration-1 underline-offset-4" : "text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4"}`}
                  >
                    {s.enabled ? "enabled" : "disabled"}
                  </button>
                </form>
                <form action={toggleSourceRequiresReview.bind(null, s.id, !s.requiresReview)}>
                  <button
                    type="submit"
                    className={`py-1.5 sm:py-0 ${s.requiresReview ? "text-sunset-deep hover:underline decoration-1 underline-offset-4" : "text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4"}`}
                  >
                    {s.requiresReview ? "requires review" : "auto-approve"}
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
