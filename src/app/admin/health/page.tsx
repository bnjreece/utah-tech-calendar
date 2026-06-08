import {
  fetchSourceHealth,
  fetchRecentErrors,
  type SourceHealth,
  type SourceHealthStatus,
} from "@/lib/health-dashboard";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";

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
  const [{ sources, summary, heartbeats }, recentErrors] = await Promise.all([
    fetchSourceHealth(),
    fetchRecentErrors(20),
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