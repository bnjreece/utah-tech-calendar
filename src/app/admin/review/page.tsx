import { eq, asc } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { approveEvent, rejectEvent } from "@/lib/admin-actions";
import { SOURCE_LABELS } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.status, "pending"))
    .orderBy(asc(events.startsAt));

  if (rows.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl italic text-ink-soft">
          The queue is empty.
        </p>
        <p className="mt-3 text-sm text-ink-soft max-w-[40ch] mx-auto text-pretty">
          New events from sources marked &quot;requires review&quot; will land
          here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-4">
        {rows.length} pending
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
              className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-6 border-t border-ink/15 first:border-t-0"
            >
              <div className={`self-stretch ${colors.bar} opacity-80`} aria-hidden />
              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <span>via {sourceLabel.toLowerCase()}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                    {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  {g && (<><span aria-hidden>·</span><span>{g.name}</span></>)}
                </div>
                <h3 className="mt-1.5 font-display text-xl leading-snug -tracking-[0.005em] text-ink">
                  {e.title}
                </h3>
                {e.description && (
                  <p className="mt-1.5 text-sm text-ink-soft text-pretty line-clamp-3 max-w-[68ch]">
                    {e.description}
                  </p>
                )}
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  {[e.venueName, e.city].filter(Boolean).join(" · ") || "no venue"}
                  {e.link && (
                    <>
                      {" · "}
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-ink hover:underline decoration-1 underline-offset-2"
                      >
                        source ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 self-start">
                <form action={approveEvent.bind(null, e.id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] rounded-full bg-ink text-paper px-3 py-2 sm:py-1.5 hover:bg-ink/85 transition-colors"
                  >
                    Approve
                  </button>
                </form>
                <form action={rejectEvent.bind(null, e.id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors py-1"
                  >
                    Reject
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
