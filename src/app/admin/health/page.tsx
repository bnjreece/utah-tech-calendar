import {
  fetchSourceHealth,
  fetchRecentErrors,
  type SourceHealth,
  type SourceHealthStatus,
} from "@/lib/health-dashboard";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";
import {
  fetchSelfHealingActivity,
  SCRAPER_DOCTOR_WORKFLOW_URL,
} from "@/lib/self-healing";
import { getClassifierStats } from "@/lib/classify-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Health · Admin" };

function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLE: Record<SourceHealthStatus, { label: string; dot: string; text: string }> = {
  ok: { label: "ok", dot: "bg-sage-deep", text: "text-sage-deep" },
  /* Quiet = working but returning 0 events. Hollow sage ring instead
     of a filled dot so it reads as "alive but empty" at a glance. */
  quiet: { label: "quiet", dot: "ring-1 ring-sage-deep bg-transparent", text: "text-ink-soft" },
  stale: { label: "stale", dot: "bg-sunset-deep", text: "text-sunset-deep" },
  broken: { label: "broken", dot: "bg-sunset-deep", text: "text-sunset-deep" },
  never: { label: "never run", dot: "bg-ink/30", text: "text-ink-soft" },
  disabled: { label: "disabled", dot: "bg-ink/20", text: "text-ink-soft" },
};

/* A row of dots, newest on the right, one per recent run. Green = ok,
   terracotta = error. The visual "is this source flaky" read. */
function RunDots({ runs }: { runs: SourceHealth["recentRuns"] }) {
  if (runs.length === 0) {
    return <span className="font-mono text-[10px] text-ink-soft">no runs</span>;
  }
  /* recentRuns comes newest-first; reverse for left-to-right time. */
  const ordered = [...runs].reverse();
  return (
    <div className="flex items-center gap-1">
      {ordered.map((r, i) => (
        <span
          key={i}
          title={`${r.status} · ${r.itemCount} items · ${r.durationMs}ms · ${r.startedAt.toLocaleString()}`}
          className={`inline-block size-2 rounded-full ${
            r.status === "ok" ? "bg-sage-deep" : "bg-sunset-deep"
          }`}
        />
      ))}
    </div>
  );
}

export default async function HealthDashboardPage() {
  const [{ sources, summary, heartbeats }, recentErrors, healing, classifier] =
    await Promise.all([
      fetchSourceHealth(),
      fetchRecentErrors(20),
      fetchSelfHealingActivity(),
      getClassifierStats(),
    ]);

  return (
    <div className="flex flex-col gap-10">
      {/* Fleet summary */}
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-4">
          Fleet · {summary.total} sources
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              { k: "ok", label: "Healthy", v: summary.ok },
              { k: "quiet", label: "Quiet", v: summary.quiet },
              { k: "stale", label: "Stale", v: summary.stale },
              { k: "broken", label: "Broken", v: summary.broken },
              { k: "never", label: "Never run", v: summary.never },
              { k: "disabled", label: "Disabled", v: summary.disabled },
            ] as const
          ).map((stat) => (
            <div
              key={stat.k}
              className="rounded-2xl ring-1 ring-ink/12 p-4 flex flex-col gap-1"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                {stat.label}
              </span>
              <span
                className={`font-display text-3xl tabular-nums ${
                  (stat.k === "broken" || stat.k === "stale") && stat.v > 0
                    ? "text-sunset-deep"
                    : "text-ink"
                }`}
              >
                {stat.v}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* LLM classifier · shadow mode */}
      <section className="border-t border-ink/15 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-4">
          Classifier · shadow mode
        </h2>
        {classifier.stats.classified === 0 ? (
          <p className="text-sm text-ink-soft max-w-[70ch]">
            No events classified yet. Set{" "}
            <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> in the Vercel
            project, then run <code className="font-mono text-[12px]">bun scripts/classify-backlog.ts</code>{" "}
            (or wait for the next scrape) to populate verdicts. In shadow mode the model logs a
            verdict on every event but changes nothing.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {(
                [
                  { label: "Classified", v: String(classifier.stats.classified), warn: false },
                  { label: "Avg confidence", v: `${Math.round(classifier.stats.avgConfidence * 100)}%`, warn: false },
                  { label: "Approved · flagged", v: String(classifier.stats.approvedButFlagged), warn: classifier.stats.approvedButFlagged > 0 },
                  { label: "Hidden · says tech", v: String(classifier.stats.hiddenButTech), warn: classifier.stats.hiddenButTech > 0 },
                ] as const
              ).map((s) => (
                <div key={s.label} className="rounded-2xl ring-1 ring-ink/12 p-4 flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    {s.label}
                  </span>
                  <span className={`font-display text-3xl tabular-nums ${s.warn ? "text-sunset-deep" : "text-ink"}`}>
                    {s.v}
                  </span>
                </div>
              ))}
            </div>
            {classifier.disagreements.length > 0 && (
              <div className="rounded-2xl ring-1 ring-ink/12 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft border-b border-ink/10">
                      <th className="px-4 py-2 font-normal">Event</th>
                      <th className="px-4 py-2 font-normal">Status</th>
                      <th className="px-4 py-2 font-normal">Model says</th>
                      <th className="px-4 py-2 font-normal text-right">Conf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classifier.disagreements.map((d) => (
                      <tr key={d.id} className="border-b border-ink/5 last:border-0">
                        <td className="px-4 py-2">
                          <a href={`/event/${d.id}`} className="hover:underline">
                            {d.title}
                          </a>
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-ink-soft">{d.status}</td>
                        <td className="px-4 py-2 font-mono text-[11px]">
                          {d.category}
                          {d.isSpam ? " · spam" : ""}
                          {!d.isTechRelevant ? " · not-tech" : ""}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {Math.round(d.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 font-mono text-[10px] text-ink-soft">
              Shadow mode - verdicts are logged only and change nothing. Disagreements are the
              model&apos;s candidates for review.
            </p>
          </>
        )}
      </section>

      {/* Self-healing · Scraper Doctor */}
      <section className="border-t border-ink/15 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Self-healing · Scraper Doctor
          </h2>
          <a
            href={SCRAPER_DOCTOR_WORKFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-sunset-deep hover:underline"
          >
            Run / view ↗
          </a>
        </div>
        <p className="text-sm text-ink-soft mb-3">
          {summary.broken > 0
            ? `${summary.broken} source${summary.broken === 1 ? "" : "s"} broken. The doctor runs Mon & Thu and opens a fix PR for review; you can also trigger it now.`
            : "All scrapers healthy — nothing for the doctor to fix."}
        </p>
        {healing.error ? (
          <p className="font-mono text-[11px] text-ink-soft">
            Couldn&apos;t load fix PRs ({healing.error}).
          </p>
        ) : healing.prs.length === 0 ? (
          <p className="font-mono text-[11px] text-ink-soft">
            No automated fix PRs yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {healing.prs.map((pr) => (
              <li key={pr.number} className="flex items-center gap-2 text-sm">
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${
                    pr.state === "open"
                      ? "text-sunset-deep ring-1 ring-sunset-deep/40"
                      : pr.state === "merged"
                        ? "text-sage-deep ring-1 ring-sage-deep/40"
                        : "text-ink-soft ring-1 ring-ink/20"
                  }`}
                >
                  {pr.state}
                </span>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate"
                >
                  #{pr.number} {pr.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cron heartbeats */}
      <section className="border-t border-ink/15 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-4">
          Cron heartbeats
        </h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft max-w-md">
          <dt>Scrape (every 3h)</dt>
          <dd className="tabular-nums">{fmtRelative(heartbeats.lastScrapeTickAt)}</dd>
          <dt>Queue digest (daily)</dt>
          <dd className="tabular-nums">{fmtRelative(heartbeats.lastQueueDigestRunAt)}</dd>
          <dt>Health alerts (daily)</dt>
          <dd className="tabular-nums">{fmtRelative(heartbeats.lastAlertsSentAt)}</dd>
        </dl>
      </section>

      {/* Per-source table */}
      <section className="border-t border-ink/15 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-4">
          Sources · worst first
        </h2>
        <ul role="list" className="flex flex-col">
          {sources.map((s) => {
            const style = STATUS_STYLE[s.status];
            const label = resolveSourceLabel(s.adapter);
            return (
              <li
                key={s.id}
                className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-start py-4 border-t border-ink/12 first:border-t-0"
              >
                <span className={`mt-1.5 inline-block size-2.5 rounded-full ${style.dot}`} aria-hidden />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-display text-base text-ink">{label}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${style.text}`}>
                      {style.label}
                    </span>
                    {s.requiresReview && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                        requires review
                      </span>
                    )}
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block font-mono text-[10px] text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-2 break-all"
                  >
                    {s.host}
                  </a>
                  <div className="mt-2 flex items-center gap-4 flex-wrap">
                    <RunDots runs={s.recentRuns} />
                    {s.runCount7d > 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft tabular-nums">
                        {Math.round(s.errorRate7d * 100)}% err · {s.avgDurationMs}ms avg · {s.runCount7d} runs / 7d
                      </span>
                    )}
                  </div>
                  {s.lastError && (
                    <p className="mt-1.5 text-xs text-sunset-deep break-words max-w-[70ch]">
                      {s.lastError.slice(0, 240)}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft tabular-nums whitespace-nowrap">
                  {fmtRelative(s.lastScrapedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Recent errors feed */}
      {recentErrors.length > 0 && (
        <section className="border-t border-ink/15 pt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-4">
            Recent errors · last {recentErrors.length}
          </h2>
          <ul role="list" className="flex flex-col gap-2">
            {recentErrors.map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-xs border-l-2 border-sunset-deep/40 pl-3 py-1"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft tabular-nums whitespace-nowrap mt-0.5">
                  {fmtRelative(e.startedAt)}
                </span>
                <div className="min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">
                    {e.host}
                  </span>
                  <p className="text-ink-soft break-words max-w-[70ch]">{e.error.slice(0, 200)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}