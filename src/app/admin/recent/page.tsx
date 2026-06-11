import { eq, desc, and, gte, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import { rejectEvent, setEventGroup } from "@/lib/admin-actions";
import { getAllGroups } from "@/lib/queries";
import { GroupPicker } from "@/components/admin-group-picker";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { displayTitle } from "@/lib/display";
import { mtDate, mtTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recent · Admin" };

/* The lookback window. 48h covers a daily review cadence while still
   including the prior day's tail scrapes - long enough to spot
   patterns, short enough that the page doesn't degrade into a
   "browse the catalog" UX. */
const WINDOW_HOURS = 48;

interface FlagStyle {
  label: string;
  classes: string;
}
const FLAG_STYLES: Record<string, FlagStyle> = {
  paid: { label: "paid", classes: "bg-dusk/[0.08] text-dusk-deep" },
  conference: { label: "conference", classes: "bg-sunset/[0.1] text-sunset-deep" },
  tentative: { label: "tentative", classes: "bg-paper-deep text-ink-soft" },
  online: { label: "online", classes: "bg-paper-deep text-ink-soft" },
};

function FlagChip({ kind }: { kind: keyof typeof FLAG_STYLES }) {
  const s = FLAG_STYLES[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${s.classes}`}
    >
      {s.label}
    </span>
  );
}

function fmtRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function RecentIngestsPage() {
  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000);

  /* Per-source ingestion volume in the window. Helps spot a source
     that just dumped 50 events at once (often a sign of a stale
     feed re-publishing). */
  const sourceCounts = await db
    .select({
      source: events.source,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        gte(events.createdAt, since),
      ),
    )
    .groupBy(events.source)
    .orderBy(desc(sql<number>`count(*)`));

  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        gte(events.createdAt, since),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(200);

  const allGroups = await getAllGroups();

  if (rows.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl italic text-ink-soft">
          No new ingests in the last {WINDOW_HOURS}h.
        </p>
        <p className="mt-3 text-sm text-ink-soft max-w-[40ch] mx-auto text-pretty">
          The scrape cron runs every 3h. If nothing here is moving, check
          source health on the overview tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-4">
        {rows.length} approved · last {WINDOW_HOURS}h
      </p>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {sourceCounts.map((s) => (
          <span key={s.source} className="tabular-nums">
            {s.count} {resolveSourceLabel(s.source).toLowerCase()}
          </span>
        ))}
      </div>
      <p className="text-sm text-ink-soft max-w-[60ch] text-pretty mb-6">
        Newest first. Useful for spotting bad source output before it ages
        into the public calendar. Click Hide on a row to flip it to
        status=hidden with reason=manual.
      </p>
      <ul role="list" className="flex flex-col">
        {rows.map(({ event: e, group: g }) => {
          const stratum = stratumForEvent(e.source);
          const colors = STRATUM_CLASSES[stratum];
          const sourceLabel = resolveSourceLabel(e.source);
          const start = new Date(e.startsAt);
          const created = new Date(e.createdAt);
          const title = displayTitle({
            title: e.title,
            link: e.link,
            group: g ? { name: g.name } : null,
            source: e.source,
          });
          return (
            <li
              key={e.id}
              className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-5 border-t border-ink/15 first:border-t-0"
            >
              <div className={`self-stretch ${colors.bar}`} aria-hidden />
              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <span>via {sourceLabel.toLowerCase()}</span>
                  <span aria-hidden>·</span>
                  <span>ingested {fmtRelative(created)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {mtDate(start, { weekday: "short", month: "short", day: "numeric" })}{" "}
                    {mtTime(start)}
                  </span>
                  {e.isPaid && <FlagChip kind="paid" />}
                  {e.isConference && <FlagChip kind="conference" />}
                  {e.isTentative && <FlagChip kind="tentative" />}
                  {e.isOnline && <FlagChip kind="online" />}
                </div>
                <h3 className="mt-1.5 font-display text-lg leading-snug -tracking-[0.005em] text-ink">
                  {title}
                </h3>
                <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
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
              <div className="flex flex-col items-end gap-2 self-start">
                <form action={rejectEvent.bind(null, e.id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors py-1"
                  >
                    Hide
                  </button>
                </form>
                <GroupPicker
                  action={setEventGroup}
                  idField="eventId"
                  idValue={e.id}
                  groups={allGroups}
                  currentId={e.groupId}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
