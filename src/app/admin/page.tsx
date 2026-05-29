import { eq, sql, gte, and } from "drizzle-orm";
import { db, events, sources } from "@/lib/db";

void sources;

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const now = new Date();
  void now;
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

  const Stat = ({ value, label }: { value: number; label: string }) => (
    <div className="border-t border-ink/15 first:border-t-0 py-5 flex items-baseline justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </span>
      <span className="font-display text-3xl tabular-nums">{value}</span>
    </div>
  );

  return (
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
  );
}
