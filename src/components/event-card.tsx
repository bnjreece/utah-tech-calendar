import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { eventSlug } from "@/lib/slugs";
import { displayTitle } from "@/lib/display";
import { mtTime, mtMonth, mtWeekday, mtDayNum } from "@/lib/time";
import { sourceLabel as resolveSourceLabel } from "@/lib/filters";
import { ActionTip } from "@/components/tooltips";

export function EventCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const stratum = stratumForEvent(event.source);
  const colors = STRATUM_CLASSES[stratum];
  const sourceLabel = resolveSourceLabel(event.source);
  const time = mtTime(start);
  const month = mtMonth(start);
  const weekday = mtWeekday(start);
  const dayNum = mtDayNum(start);
  /* Slug uses raw title for URL stability; presentation uses the
     prettified form so "TBD" reads as e.g. "Utah Go · TBD". */
  const title = displayTitle(event);

  return (
    <Link
      data-event-card
      href={`/event/${eventSlug(event.title, event.id)}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg shadow-sm ring-1 ring-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
    >
      <div data-card-bar className={`h-2 ${colors.bar}`} aria-hidden />
      <div className="p-5 flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          {Number.isFinite(dayNum) ? (
            <div className="flex flex-col items-start tabular-nums">
              <span className="text-xs uppercase tracking-wide text-ink-soft">
                {weekday}
              </span>
              <span className="text-3xl font-medium leading-none mt-0.5">
                {dayNum}
              </span>
              <span className="text-xs uppercase tracking-wide text-ink-soft mt-0.5">
                {month}
              </span>
            </div>
          ) : (
            <div aria-hidden />
          )}
          <ActionTip tip="Where we found this listing; use the Source filter to narrow by it.">
            <span
              data-source-chip
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colors.chip}`}
            >
              {sourceLabel}
            </span>
          </ActionTip>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg leading-snug text-balance group-hover:text-sunset-deep transition-colors">
            {title}
          </h3>
          {event.description && (
            <p className="mt-1.5 text-sm text-ink-soft text-pretty line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        <div className="mt-auto text-sm text-ink-soft flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
          <span className={colors.text}>{time}</span>
          {event.venueName && (
            <>
              <span aria-hidden className="text-ink/20">·</span>
              <span className="truncate">{event.venueName}</span>
            </>
          )}
          {event.city && (
            <>
              <span aria-hidden className="text-ink/20">·</span>
              <span>{event.city}</span>
            </>
          )}
          {event.isOnline && (
            <>
              <span aria-hidden className="text-ink/20">·</span>
              <span className="text-dusk-deep">Online</span>
            </>
          )}
        </div>

        {(event.group || (event.tags && event.tags.length > 0)) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-ink-soft pt-1">
            {event.group && <span>{event.group.name}</span>}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1" role="list">
                {event.tags.slice(0, 4).map((t) => (
                  <ActionTip
                    key={t}
                    tip="A topic tag; use the Tag filter to find more like this."
                  >
                    <span
                      role="listitem"
                      className="inline-flex items-center rounded-full bg-paper-deep px-2 py-0.5 text-xs text-ink-soft"
                    >
                      {t}
                    </span>
                  </ActionTip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
