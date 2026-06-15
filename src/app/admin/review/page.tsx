import { eq, asc } from "drizzle-orm";
import { db, events, groups, pendingSubmissions } from "@/lib/db";
import {
  approveEvent,
  rejectEvent,
  approveSubmission,
  rejectSubmission,
} from "@/lib/admin-actions";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { displayTitle } from "@/lib/display";
import { mtDate, mtTime } from "@/lib/time";
import { StrataLegendTip, ActionTip } from "@/components/tooltips";

export const dynamic = "force-dynamic";

interface SubmissionPayload {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  link?: unknown;
  startsAt?: unknown;
  venueName?: unknown;
  city?: unknown;
  url?: unknown;
  note?: unknown;
}

function strField(p: SubmissionPayload, key: keyof SubmissionPayload): string | null {
  const v = p[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function isSourceSuggestion(p: SubmissionPayload): boolean {
  return p?.type === "source" && typeof p?.url === "string";
}

export default async function ReviewQueuePage() {
  const eventRows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.status, "pending"))
    .orderBy(asc(events.startsAt));

  const allPending = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.status, "pending"))
    .orderBy(asc(pendingSubmissions.createdAt));

  /* Two flavors of pending row land here: event drafts (from /submit)
     and source suggestions (from /submit-source). Split for clarity. */
  const submissionRows = allPending.filter(
    (r) => !isSourceSuggestion((r.payload ?? {}) as SubmissionPayload),
  );
  const sourceRows = allPending.filter((r) =>
    isSourceSuggestion((r.payload ?? {}) as SubmissionPayload),
  );

  if (eventRows.length === 0 && submissionRows.length === 0 && sourceRows.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl italic text-ink-soft">
          The queue is empty.
        </p>
        <p className="mt-3 text-sm text-ink-soft max-w-[40ch] mx-auto text-pretty">
          New events from sources marked &quot;requires review&quot; and
          drafts from /submit will both land here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        <span className="inline-flex items-center gap-1">
          {eventRows.length} scraped · {submissionRows.length} submitted
          {sourceRows.length > 0 ? ` · ${sourceRows.length} source suggestions` : ""}
          <StrataLegendTip />
        </span>
      </p>

      {eventRows.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep mb-4">
            Scraped · {eventRows.length}
          </h2>
          <ul role="list" className="flex flex-col">
            {eventRows.map(({ event: e, group: g }) => {
              const stratum = stratumForEvent(e.source);
              const colors = STRATUM_CLASSES[stratum];
              const sourceLabel = resolveSourceLabel(e.source);
              const start = new Date(e.startsAt);
              const title = displayTitle({
                title: e.title,
                link: e.link,
                group: g ? { name: g.name } : null,
                source: e.source,
              });
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
                        {mtDate(start, { weekday: "short", month: "short", day: "numeric" })}{" "}
                        {mtTime(start)}
                      </span>
                      {g && (<><span aria-hidden>·</span><span>{g.name}</span></>)}
                    </div>
                    <h3 className="mt-1.5 font-display text-xl leading-snug -tracking-[0.005em] text-ink">
                      {title}
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
                      <ActionTip tip="Publishes this event and locks it against the router.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] rounded-full bg-ink text-paper px-3 py-2 sm:py-1.5 hover:bg-ink/85 transition-colors"
                        >
                          Approve
                        </button>
                      </ActionTip>
                    </form>
                    <form action={rejectEvent.bind(null, e.id)}>
                      <ActionTip tip="Hides this event and locks it against the router.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors py-1"
                        >
                          Reject
                        </button>
                      </ActionTip>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {submissionRows.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusk-deep mb-4">
            Submitted · {submissionRows.length}
          </h2>
          <ul role="list" className="flex flex-col">
            {submissionRows.map((s) => {
              const p = (s.payload as SubmissionPayload) ?? {};
              const title = strField(p, "title") ?? "(untitled draft)";
              const desc = strField(p, "description");
              const link = strField(p, "link");
              const startsAt = strField(p, "startsAt");
              const venue = strField(p, "venueName");
              const city = strField(p, "city");
              const submitter = s.submitterName ?? s.submitterEmail ?? "anonymous";
              const start = startsAt ? new Date(startsAt) : null;
              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-6 border-t border-ink/15 first:border-t-0"
                >
                  <div className="self-stretch bg-dusk-deep/40" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                      <span>from {submitter}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {start && !Number.isNaN(start.getTime())
                          ? `${mtDate(start, { weekday: "short", month: "short", day: "numeric" })} ${mtTime(start)}`
                          : "date tbd"}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-xl leading-snug -tracking-[0.005em] text-ink">
                      {title}
                    </h3>
                    {desc && (
                      <p className="mt-1.5 text-sm text-ink-soft text-pretty line-clamp-3 max-w-[68ch]">
                        {desc}
                      </p>
                    )}
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                      {[venue, city].filter(Boolean).join(" · ") || "no venue"}
                      {link && (
                        <>
                          {" · "}
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-ink hover:underline decoration-1 underline-offset-2"
                          >
                            submitter link ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <form action={approveSubmission.bind(null, s.id)}>
                      <ActionTip tip="Publishes this event and locks it against the router.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] rounded-full bg-ink text-paper px-3 py-2 sm:py-1.5 hover:bg-ink/85 transition-colors"
                        >
                          Approve
                        </button>
                      </ActionTip>
                    </form>
                    <form action={rejectSubmission.bind(null, s.id)}>
                      <ActionTip tip="Hides this event and locks it against the router.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors py-1"
                        >
                          Reject
                        </button>
                      </ActionTip>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sourceRows.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep mb-4">
            Source suggestions · {sourceRows.length}
          </h2>
          <p className="text-xs text-ink-soft mb-5 max-w-[60ch] text-pretty">
            Whole-calendar suggestions from{" "}
            <code className="font-mono">/submit</code>. Approving
            registers the URL as a scrape source with{" "}
            <code className="font-mono">requires_review</code> on, so
            its first round of events lands here too before going
            public.
          </p>
          <ul role="list" className="flex flex-col">
            {sourceRows.map((s) => {
              const p = (s.payload as SubmissionPayload) ?? {};
              const url = strField(p, "url") ?? "";
              const note = strField(p, "note");
              const submitter = s.submitterName ?? s.submitterEmail ?? "anonymous";
              let host = url;
              try {
                host = new URL(url).hostname;
              } catch {
                /* leave as-is */
              }
              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[3px_1fr_auto] gap-x-5 items-start py-6 border-t border-ink/15 first:border-t-0"
                >
                  <div className="self-stretch bg-sage-deep/40" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                      <span>from {submitter}</span>
                      <span aria-hidden>·</span>
                      <span>source suggestion</span>
                    </div>
                    <h3 className="mt-1.5 font-display text-xl leading-snug -tracking-[0.005em] text-ink">
                      {host}
                    </h3>
                    {note && (
                      <p className="mt-1.5 text-sm text-ink-soft text-pretty line-clamp-3 max-w-[68ch]">
                        {note}
                      </p>
                    )}
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft break-all">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-ink hover:underline decoration-1 underline-offset-2"
                      >
                        {url} ↗
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <form action={approveSubmission.bind(null, s.id)}>
                      <ActionTip tip="Adds this URL as a scrape source with review required on its first batch.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] rounded-full bg-ink text-paper px-3 py-2 sm:py-1.5 hover:bg-ink/85 transition-colors"
                        >
                          Register source
                        </button>
                      </ActionTip>
                    </form>
                    <form action={rejectSubmission.bind(null, s.id)}>
                      <ActionTip tip="Hides this event and locks it against the router.">
                        <button
                          type="submit"
                          className="font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors py-1"
                        >
                          Reject
                        </button>
                      </ActionTip>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
