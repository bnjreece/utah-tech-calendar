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

function detectAlerts(sourceRows: typeof sources.$inferSelect[]): SourceAlert[] {
  const alerts: SourceAlert[] = [];
  const now = Date.now();
  const STALE_MS = 24 * 60 * 60 * 1000;

  for (const s of sourceRows) {
    if (!s.enabled) continue;

    /* Silicon Slopes returning 0 = cookie expired (most common failure). */
    if (s.adapter === "siliconSlopes" && /ok: 0 items/i.test(s.lastStatus ?? "")) {
      alerts.push({
        level: "urgent",
        title: "Silicon Slopes scraper returned 0 events",
        body: `Last scrape: ${s.lastScrapedAt ? new Date(s.lastScrapedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never"}. The session cookie likely expired.`,
        action: "Sign in at siliconslopes.com, then ask Claude to rotate the cookie.",
      });
      continue;
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

    /* Source that is enabled but has never run, or hasn't run in over 24h */
    const lastRunMs = s.lastScrapedAt ? new Date(s.lastScrapedAt).getTime() : null;
    if (lastRunMs === null) {
      alerts.push({
        level: "warn",
        title: `${s.adapter} source never scraped`,
        body: s.url,
      });
    } else if (now - lastRunMs > STALE_MS) {
      const hours = Math.round((now - lastRunMs) / (60 * 60 * 1000));
      alerts.push({
        level: "warn",
        title: `${s.adapter} source stale (${hours}h since last scrape)`,
        body: s.url,
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
