import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Submitted",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

export function EventCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;
  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[--spacing(16)_1fr] gap-x-6 gap-y-2 py-6 transition-colors"
    >
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-foreground/50">
          {start.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
        <div className="font-display text-4xl leading-none mt-0.5">
          {start.getDate()}
        </div>
        <div className="text-xs uppercase tracking-wide text-foreground/50 mt-0.5">
          {start.toLocaleDateString("en-US", { month: "short" })}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight text-balance text-foreground group-hover:text-brand transition-colors">
            {event.title}
          </h3>
          <span className="hidden shrink-0 text-xs uppercase tracking-wide text-foreground/40 sm:inline">
            {sourceLabel}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
          <span>{time}</span>
          {event.venueName && (
            <>
              <span aria-hidden className="text-foreground/30">·</span>
              <span className="truncate">{event.venueName}</span>
            </>
          )}
          {event.city && (
            <>
              <span aria-hidden className="text-foreground/30">·</span>
              <span>{event.city}</span>
            </>
          )}
          {event.isOnline && (
            <>
              <span aria-hidden className="text-foreground/30">·</span>
              <span className="text-brand-deep">Online</span>
            </>
          )}
        </p>

        {event.description && (
          <p className="mt-2 text-sm text-foreground/60 text-pretty line-clamp-2 max-w-[68ch]">
            {event.description}
          </p>
        )}

        {(event.group || (event.tags && event.tags.length)) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/55">
            {event.group && <span>{event.group.name}</span>}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="list">
                {event.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    role="listitem"
                    className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
