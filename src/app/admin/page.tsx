import Link from "next/link";
import { eq, sql, gte, and } from "drizzle-orm";
import { db, events, sources } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SourceAlert {
  level: "urgent" | "warn";
  title: string;
  body: string;
  action?: string;
}

/* Tied to the exact format scrape-runner writes: `ok: ${N} items`. */
const ZERO_ITEMS = /^ok: 0 items$/i;
/* Silicon Slopes adapter now throws on 401/403 with this exact suffix
   (silicon-slopes.ts:91), which the runner persists as lastError. */
const SS_COOKIE_EXPIRED_RE = /session cookie likely expired/i;

function detectAlerts(sourceRows: typeof sources.$inferSelect[]): SourceAlert[] {
  const alerts: SourceAlert[] = [];
  const now = Date.now();
  const STALE_MS = 24 * 60 * 60 * 1000;
  const enabled = sourceRows.filter((s) => s.enabled);
  const staleEnabled: typeof enabled = [];

  for (const s of enabled) {
    /* Silicon Slopes cookie expired - matches either the legacy "ok: 0
       items" path (kept in case the adapter ever stops throwing) and the
       current "Circle API 401/403" thrown-error path. */
    const ssZero = s.adapter === "siliconSlopes" && ZERO_ITEMS.test((s.lastStatus ?? "").trim());
    const ssAuthErr = s.adapter === "siliconSlopes" && SS_COOKIE_EXPIRED_RE.test(s.lastError ?? "");
    if (ssZero || ssAuthErr) {
      alerts.push({
        level: "urgent",
        title: "Silicon Slopes cookie expired",
        body: `Last scrape: ${s.lastScrapedAt ? new Date(s.lastScrapedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never"}. ${ssAuthErr ? "Circle API rejected the session cookie." : "Scraper returned 0 events - likely cookie expiry."}`,
        action: "Sign in at siliconslopes.com, then ask Claude to rotate the cookie.",
      });
      continue;
    }

    /* Preemptive cookie-age alert. The Silicon Slopes session cookie
       has a ~60-90d lifetime; warn at 50d, urgent at 80d so we rotate
       before it silently dies. */
    if (s.authRotatedAt) {
      const days = Math.round(
        (Date.now() - new Date(s.authRotatedAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days >= 80) {
        alerts.push({
          level: "urgent",
          title: `${s.adapter} session cookie is ${days} days old`,
          body: `Cookie is past the typical 60-90d expiry window. Rotate before the next scrape returns 0 events.`,
          action: "Sign in at the source, then ask Claude to rotate the cookie.",
        });
        continue;
      }
      if (days >= 50) {
        alerts.push({
          level: "warn",
          title: `${s.adapter} session cookie is ${days} days old`,
          body: "Approaching the typical expiry window. Plan to rotate in the next few weeks.",
        });
        continue;
      }
    }

    /* Any source with an error status */
    if (s.lastError) {
      alerts.push({
        level: "urgent",
        title: `${s.adapter} scraper errored`,
        body: `${s.url} · ${s.lastError.slice(0, 200)}`,
      });
      continue;
    }

    /* Collect stale candidates for the meta-alert below. */
    const lastRunMs = s.lastScrapedAt ? new Date(s.lastScrapedAt).getTime() : null;
    if (lastRunMs === null || now - lastRunMs > STALE_MS) {
      staleEnabled.push(s);
    }
  }

  /* Stale meta-alert: if cron stopped firing, ~24 sources go stale at
     once. Collapse into one alert rather than burying the rest of the
     page in warn cards. Show individual cards only when 3 or fewer
     enabled sources are stale (i.e. a real per-source issue). */
  if (staleEnabled.length > 0 && staleEnabled.length >= enabled.length - 2) {
    alerts.push({
      level: "urgent",
      title: `Cron may have stopped firing - ${staleEnabled.length} of ${enabled.length} sources stale`,
      body: "All or nearly all enabled sources have not scraped in over 24 hours. Check Vercel Functions logs and the cron schedule.",
    });
  } else {
    for (const s of staleEnabled.slice(0, 5)) {
      const hours = s.lastScrapedAt
        ? Math.round((now - new Date(s.lastScrapedAt).getTime()) / (60 * 60 * 1000))
        : null;
      alerts.push({
        level: "warn",
        title: hours === null
          ? `${s.adapter} source never scraped`
          : `${s.adapter} source stale (${hours}h since last scrape)`,
        body: s.url,
      });
    }
    if (staleEnabled.length > 5) {
      alerts.push({
        level: "warn",
        title: `+${staleEnabled.length - 5} more stale sources`,
        body: "Open Sources to triage.",
      });
    }
  }

  return alerts;
}

export default async function AdminOverviewPage() {
  const now = new Date();
  const [pendingCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, "pending"));
  const [hiddenCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, "hidden"));
  const [approvedUpcomingCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.status, "approved"), gte(events.startsAt, now)));
  const sourceRows = await db.select().from(sources);
  const enabledSources = sourceRows.filter((s) => s.enabled).length;
  const reviewedSources = sourceRows.filter((s) => s.requiresReview).length;
  const alerts = detectAlerts(sourceRows);

  const Stat = ({ value, label }: { value: number; label: string }) => (
    <div className="border-t border-ink/15 first:border-t-0 py-5 flex items-baseline justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </span>
      <span className="font-display text-3xl tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-12">
      {alerts.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sunset-deep mb-3">
            {alerts.length === 1 ? "1 issue needs attention" : `${alerts.length} issues need attention`}
          </p>
          <ul role="list" className="flex flex-col gap-3">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={
                  a.level === "urgent"
                    ? "border-l-[3px] border-sunset-deep bg-sunset/[0.06] pl-4 pr-4 py-4"
                    : "border-l-[3px] border-ink/30 bg-paper-deep/40 pl-4 pr-4 py-4"
                }
              >
                <p className="font-display text-base tracking-tight">
                  {a.title}
                </p>
                <p className="mt-1 text-sm text-ink-soft text-pretty break-words">
                  {a.body}
                </p>
                {a.action && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sunset-deep">
                    {a.action}
                  </p>
                )}
                <Link
                  href="/admin/sources"
                  className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4"
                >
                  open sources →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
        <section>
          <h2 className="font-display text-xl italic mb-2">Events</h2>
          <Stat value={pendingCount.c} label="Pending review" />
          <Stat value={approvedUpcomingCount.c} label="Approved · upcoming" />
          <Stat value={hiddenCount.c} label="Hidden" />
        </section>
        <section>
          <h2 className="font-display text-xl italic mb-2">Sources</h2>
          <Stat value={sourceRows.length} label="Total sources" />
          <Stat value={enabledSources} label="Enabled" />
          <Stat value={reviewedSources} label="Require review" />
        </section>
      </div>
    </div>
  );
}
