import { eq, asc, gte, and } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { restoreEvent } from "@/lib/admin-actions";
import { SOURCE_LABELS } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";

export const dynamic = "force-dynamic";

export default async function HiddenEventsPage() {
  const now = new Date();
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(eq(events.status, "hidden"), gte(events.startsAt, now)))
    .orderBy(asc(events.startsAt));

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-4">
        {rows.length} hidden · upcoming only
      </p>
      <p className="text-sm text-ink-soft max-w-[60ch] text-pretty mb-6">
        Events suppressed by the dedup sweep or the topic filter. Click Restore
        to bring one back to the public schedule.
      </p>
      <ul role="list" className="flex flex-col">
        {rows.map(({ event: e, group: g }) => {
          const stratum = stratumForEvent(e.source);
          const colors = STRATUM_CLASSES[stratum];
          const sourceLabel = SOURCE_LABELS[e.source] ?? e.source;
          const start = new Date(e.startsAt);
          return (
            <li
              key={e.id}
              className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-5 border-t border-ink/15 first:border-t-0"
            >
              <div className={`self-stretch ${colors.bar} opacity-50`} aria-hidden />
              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <span>via {sourceLabel.toLowerCase()}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {g && (<><span aria-hidden>·</span><span>{g.name}</span></>)}
                </div>
                <h3 className="mt-1 font-display text-lg leading-snug text-ink-soft">
                  {e.title}
                </h3>
              </div>
              <form action={restoreEvent.bind(null, e.id)}>
                <button
                  type="submit"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
                >
                  Restore
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
