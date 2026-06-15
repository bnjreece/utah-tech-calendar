import { eq, asc, gte, and, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { restoreEvent } from "@/lib/admin-actions";
import { SOURCE_LABELS, sourceLabel as resolveSourceLabel } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { displayTitle } from "@/lib/display";
import { mtDate } from "@/lib/time";
import { ReasonTip } from "@/components/tooltips";

export const dynamic = "force-dynamic";

/* Visual decoration for the hidden_reason chip on each row. Each
   reason gets a different tint so the page reads as a stratified
   audit ledger - craft/cert-spam/cross-post buckets all answer
   different questions about scraper quality. */
const REASON_STYLE: Record<string, { label: string; classes: string }> = {
  craft: {
    label: "craft",
    classes: "bg-paper-deep text-ink-soft",
  },
  "cert-spam": {
    label: "cert-spam",
    classes: "bg-sunset/[0.08] text-sunset-deep",
  },
  "cross-post": {
    label: "cross-post",
    classes: "bg-dusk/[0.08] text-dusk-deep",
  },
  manual: {
    label: "manual",
    classes: "bg-ink/[0.06] text-ink",
  },
  "source-disabled": {
    label: "source off",
    classes: "bg-paper-deep text-ink-soft",
  },
};

function ReasonChip({ reason }: { reason: string | null }) {
  const style = reason ? REASON_STYLE[reason] : null;
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${style.classes}`}
    >
      {style.label}
    </span>
  );
}

export default async function HiddenEventsPage() {
  const now = new Date();
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(eq(events.status, "hidden"), gte(events.startsAt, now)))
    .orderBy(asc(events.startsAt));

  /* Group counts so the header reads as a quality report:
     "8 craft · 15 cert-spam · 14 cross-post · 19 manual". Helps
     the admin spot when a heuristic over-fires. */
  const reasonCounts = await db
    .select({
      reason: events.hiddenReason,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(eq(events.status, "hidden"))
    .groupBy(events.hiddenReason)
    .orderBy(sql`count(*) desc`);

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-4">
        {rows.length} hidden · upcoming only
      </p>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {reasonCounts.map((r) => (
          <span key={r.reason ?? "null"} className="tabular-nums">
            {r.count} {r.reason ?? "(unlabelled)"}
          </span>
        ))}
      </div>
      <p className="text-sm text-ink-soft max-w-[60ch] text-pretty mb-6">
        Events suppressed by the dedup sweep, craft filter, cert-spam filter,
        or a manual reject. Click Restore to bring one back.
      </p>
      <ul role="list" className="flex flex-col">
        {rows.map(({ event: e, group: g }) => {
          const stratum = stratumForEvent(e.source);
          const colors = STRATUM_CLASSES[stratum];
          const sourceLabel = resolveSourceLabel(e.source);
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
                    {mtDate(start, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {g && (<><span aria-hidden>·</span><span>{g.name}</span></>)}
                  <ReasonChip reason={e.hiddenReason} />
                  {e.hiddenReason && <ReasonTip reason={e.hiddenReason} />}
                </div>
                <h3 className="mt-1 font-display text-lg leading-snug text-ink-soft">
                  {displayTitle({ title: e.title, link: e.link, group: g ? { name: g.name } : null, source: e.source })}
                </h3>
              </div>
              <form action={restoreEvent.bind(null, e.id)}>
                <button
                  type="submit"
                  className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors py-1"
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
