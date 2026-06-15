import { and, eq, gte, ilike, desc, sql } from "drizzle-orm";
import { db, events, groups, adminSettings } from "@/lib/db";
import { restoreEvent, sendEventToReview, saveLlmGate } from "@/lib/admin-actions";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { displayTitle } from "@/lib/display";
import { mtDate } from "@/lib/time";
import { InfoTip } from "@/components/ui/tooltip";
import { ActionTip } from "@/components/tooltips";

export const dynamic = "force-dynamic";
export const metadata = { title: "Screened · Admin" };

const PER_PAGE = 50;

type Verdict = {
  category?: string;
  confidence?: number;
  reasoning?: string;
  isSpam?: boolean;
  isTechRelevant?: boolean;
};

export default async function ScreenedEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const rawPage = Math.max(1, Number(sp.page) || 1);
  const now = new Date();

  /* Auto-screened = hidden by the LLM gate. Upcoming only (the gate never
     classifies past events). */
  const where = and(
    eq(events.status, "hidden"),
    eq(events.hiddenReason, "llm-screened"),
    gte(events.startsAt, now),
    q ? ilike(events.title, `%${q}%`) : undefined,
  );

  const [gate] = await db
    .select({
      enabled: adminSettings.llmGateEnabled,
      threshold: adminSettings.llmGateThreshold,
    })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  const gateEnabled = gate?.enabled ?? false;
  const gateThreshold = Number(gate?.threshold ?? 0.92);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(events)
    .where(where);

  /* Clamp the page to the real range so a stale bookmark / hand-edited URL
     (?page=9999) doesn't render a misleading empty state. */
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(rawPage, totalPages);

  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(where)
    .orderBy(desc(events.llmCheckedAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);

  /* Category breakdown across all screened (page-independent) but honoring
     the active search, so the chips track the visible result set. */
  const catRows = await db
    .select({
      category: sql<string>`coalesce(llm_verdict->>'category', '(none)')`,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(where)
    .groupBy(sql`coalesce(llm_verdict->>'category', '(none)')`)
    .orderBy(sql`count(*) desc`)
    .limit(12);
  const pageHref = (p: number) =>
    `/admin/screened?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      {/* Gate config */}
      <section className="rounded-2xl ring-1 ring-ink/12 p-4 mb-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-3">
          <span className="inline-flex items-center gap-1">
            Hard-gate
            <InfoTip label="The rule that lets the model auto-hide flagged events instead of only logging a verdict." />
          </span>
        </h2>
        <form action={saveLlmGate} className="flex flex-wrap items-end gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={gateEnabled}
              className="size-4 accent-sunset-deep"
            />
            <span className="inline-flex items-center gap-1">
              Auto-screen enabled{" "}
              <span className={gateEnabled ? "text-sage-deep" : "text-ink-soft"}>
                ({gateEnabled ? "on" : "off / shadow"})
              </span>
              <InfoTip label="On lets the gate hide flagged events; off keeps it in shadow mode where verdicts are logged but nothing is hidden." />
            </span>
          </label>
          <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            <span className="inline-flex items-center gap-1">
              Confidence bar
              <InfoTip label="The minimum model confidence to auto-hide; below this, flagged events go to review instead." />
            </span>
            <input
              type="number"
              name="threshold"
              step="0.01"
              min="0.5"
              max="1"
              defaultValue={gateThreshold}
              className="w-24 rounded-md ring-1 ring-ink/15 px-2 py-1 text-sm tabular-nums text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-ink text-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-ink/85 transition-colors"
          >
            Save
          </button>
        </form>
        <p className="mt-3 text-[12px] text-ink-soft max-w-[68ch] text-pretty">
          When on, the classifier auto-hides a flagged event only at confidence
          ≥ the bar; everything else flagged goes to{" "}
          <a href="/admin/review" className="underline">review</a>. Off = pure
          shadow (verdicts logged, nothing hidden). Raise the bar to send more to
          humans.
        </p>
      </section>

      {/* Header + search */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          {total} auto-screened · upcoming
        </p>
        <form action="/admin/screened" method="get" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="search title…"
            className="rounded-md ring-1 ring-ink/15 px-2.5 py-1 text-sm w-48"
          />
          <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink">
            search
          </button>
        </form>
      </div>
      {catRows.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          {catRows.map((c) => (
            <span key={c.category} className="tabular-nums">
              {c.count} {c.category}
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {q ? "No screened events match that search." : "Nothing auto-screened yet."}
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {rows.map(({ event: e, group: g }) => {
            const colors = STRATUM_CLASSES[stratumForEvent(e.source)];
            const v = (e.llmVerdict ?? {}) as Verdict;
            const conf = typeof v.confidence === "number" ? Math.round(v.confidence * 100) : null;
            return (
              <li
                key={e.id}
                className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-5 border-t border-ink/15 first:border-t-0"
              >
                <div className={`self-stretch ${colors.bar} opacity-50`} aria-hidden />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    <span>via {resolveSourceLabel(e.source).toLowerCase()}</span>
                    <span aria-hidden>·</span>
                    <span>{mtDate(new Date(e.startsAt), { weekday: "short", month: "short", day: "numeric" })}</span>
                    {v.category && (
                      <span className="inline-flex items-center rounded-full bg-sunset/[0.08] text-sunset-deep px-2 py-0.5 text-[10px] tracking-[0.14em]">
                        {v.category}
                        {conf !== null ? ` · ${conf}%` : ""}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 font-display text-lg leading-snug text-ink-soft">
                    {displayTitle({ title: e.title, link: e.link, group: g ? { name: g.name } : null, source: e.source })}
                  </h3>
                  {v.reasoning && (
                    <p className="mt-1 text-[12px] text-ink-soft/80 max-w-[70ch] text-pretty italic">
                      {v.reasoning}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <form action={restoreEvent.bind(null, e.id)}>
                    <ActionTip tip="Publishes this event now and locks it against the router.">
                      <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sage-deep hover:underline decoration-1 underline-offset-4 transition-colors">
                        Restore
                      </button>
                    </ActionTip>
                  </form>
                  <form action={sendEventToReview.bind(null, e.id)}>
                    <ActionTip tip="Moves this event to the human review queue instead of leaving it screened.">
                      <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                        Send to review
                      </button>
                    </ActionTip>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
          {page > 1 ? (
            <a href={pageHref(page - 1)} className="text-ink-soft hover:text-ink hover:underline">← prev</a>
          ) : (
            <span className="text-ink/25">← prev</span>
          )}
          <span className="text-ink-soft tabular-nums">page {page} / {totalPages}</span>
          {page < totalPages ? (
            <a href={pageHref(page + 1)} className="text-ink-soft hover:text-ink hover:underline">next →</a>
          ) : (
            <span className="text-ink/25">next →</span>
          )}
        </div>
      )}
    </div>
  );
}
