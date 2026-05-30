import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Community",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

function fmtDate(d: Date) {
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    day: d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short" }),
    monthFull: d.toLocaleDateString("en-US", { month: "long" }),
    year: d.getFullYear(),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    iso: d.toISOString().slice(0, 16).replace("T", " "),
  };
}

/* ============================================================
   Editorial Strip — Apartamento/Vinh stripped hairline row
   ============================================================ */
export function EditorialStripCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = SOURCE_LABELS[event.source] ?? event.source;
  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[--spacing(20)_1fr] sm:grid-cols-[--spacing(28)_1fr] gap-6 sm:gap-10 items-baseline py-8 sm:py-10 border-t border-ink/15 first:border-t-0 transition-colors"
    >
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          {d.weekday}
        </span>
        <span className="mt-1 font-display text-5xl sm:text-6xl leading-none text-ink tabular-nums">
          {d.day}
        </span>
        <span className="mt-1 font-display italic text-base sm:text-lg text-ink-soft">
          {d.monthFull.toLowerCase()}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-3xl sm:text-4xl leading-[1.05] tracking-tight text-balance text-ink group-hover:text-sunset-deep transition-colors">
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-3 text-base text-ink-soft text-pretty line-clamp-2 max-w-[60ch] leading-relaxed">
            {event.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.16em] text-ink-soft">
          <span className="tabular-nums">{d.time}</span>
          {(event.venueName || event.city) && (
            <>
              <span aria-hidden>·</span>
              <span>{[event.venueName, event.city].filter(Boolean).join(" · ")}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>via {source.toLowerCase()}</span>
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   Editorial Linear — Curtis pure index list
   Strict 2-col grid, both rows live in same right column for
   pixel-perfect alignment of title + metadata.
   ============================================================ */
/* Dense one-line row for monthly view. Title gets truncate so many days
   fit per fold; venue is dropped entirely. */
export function EditorialLinearCardCompact({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const stratum = stratumForEvent(event.source);
  const colors = STRATUM_CLASSES[stratum];
  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[3px_--spacing(14)_1fr] sm:grid-cols-[3px_--spacing(16)_1fr] gap-x-3 sm:gap-x-4 items-baseline py-1.5 border-t border-ink/10 first:border-t-0 transition-colors"
    >
      <div className={`self-stretch ${colors.bar} opacity-70 group-hover:opacity-100 transition-opacity`} aria-hidden />
      <div className="self-baseline font-mono text-[10px] tracking-[0.12em] text-ink-soft tabular-nums normal-case">
        {d.time.toLowerCase().replace(/\s/g, "")}
      </div>
      <h3 className="font-display text-sm sm:text-base leading-snug text-ink truncate group-hover:text-sunset-deep transition-colors">
        {event.title}
      </h3>
    </Link>
  );
}

/* Used inside a day-grouped list (see EditorialLinearBlock). The day header
   carries the date; this row only carries time + title + venue. */
export function EditorialLinearCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = SOURCE_LABELS[event.source] ?? event.source;
  const stratum = stratumForEvent(event.source);
  const colors = STRATUM_CLASSES[stratum];
  const placeParts = [event.venueName, event.city].filter(Boolean);
  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[3px_--spacing(16)_1fr] sm:grid-cols-[3px_--spacing(18)_1fr] gap-x-5 sm:gap-x-6 items-baseline py-5 border-t border-ink/15 first:border-t-0 transition-colors"
    >
      <div className={`self-stretch ${colors.bar} opacity-80 group-hover:opacity-100 transition-opacity`} aria-hidden />
      <div className="self-start pt-1.5 font-mono text-[11px] tracking-[0.14em] text-ink-soft tabular-nums normal-case">
        {d.time.toLowerCase().replace(/\s/g, "")}
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-xl sm:text-2xl leading-[1.2] -tracking-[0.005em] text-pretty text-ink group-hover:text-sunset-deep group-hover:underline decoration-1 underline-offset-4 transition-colors">
          {event.title}
        </h3>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          {placeParts.length > 0 && (
            <>
              {placeParts.join(" · ")}
              <span aria-hidden> · </span>
            </>
          )}
          <span>via {source.toLowerCase()}</span>
        </p>
      </div>
    </Link>
  );
}

/* ============================================================
   Wasatch — outdoor field guide
   ============================================================ */
export function WasatchCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = SOURCE_LABELS[event.source] ?? event.source;
  return (
    <Link
      href={`/event/${event.id}`}
      className="group block rounded-[14px] bg-card ring-1 ring-ink/10 overflow-hidden transition-all hover:ring-ink/25 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-ink/8">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          N {(40 + event.id.charCodeAt(0) / 255 * 0.4).toFixed(2)}° / W {(111 + event.id.charCodeAt(1) / 255 * 0.5).toFixed(2)}°
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          [{source.toLowerCase()}]
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-baseline gap-3 font-mono text-sm">
          <span className="text-ink-soft tabular-nums">{d.weekday.toUpperCase()}</span>
          <span className="text-2xl tabular-nums font-semibold text-ink">{d.day}</span>
          <span className="text-ink-soft uppercase tracking-wide text-xs">{d.month}</span>
          <span className="ml-auto text-ink-soft tabular-nums">{d.time}</span>
        </div>
        <h3 className="mt-4 font-display text-2xl leading-[1.15] tracking-tight text-balance group-hover:text-sunset-deep transition-colors">
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-2 text-sm text-ink-soft text-pretty line-clamp-2">
            {event.description}
          </p>
        )}
        <div className="mt-4 pt-3 border-t border-dashed border-ink/15 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft font-mono uppercase tracking-wide">
          {event.venueName && <span>{event.venueName}</span>}
          {event.city && (
            <>
              <span aria-hidden>·</span>
              <span>{event.city}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   Apartment — magazine editorial, horizontal strip
   ============================================================ */
export function ApartmentCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = SOURCE_LABELS[event.source] ?? event.source;
  return (
    <Link
      href={`/event/${event.id}`}
      className="group grid grid-cols-[--spacing(24)_1fr] gap-6 py-8 border-t border-ink/15 transition-colors hover:bg-ink/[0.03] -mx-3 px-3"
    >
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          {d.weekday}
        </span>
        <span className="mt-1 font-display text-5xl leading-none text-ink tabular-nums">
          {d.day}
        </span>
        <span className="mt-1 font-display italic text-base text-ink-soft">
          {d.monthFull.toLowerCase()}
        </span>
      </div>
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sunset-deep">
          № {source}
        </span>
        <h3 className="mt-2 font-display text-4xl sm:text-5xl leading-[1.02] tracking-tight text-balance group-hover:text-sunset-deep transition-colors">
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-3 text-base text-ink-soft text-pretty line-clamp-2 max-w-[60ch]">
            {event.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft font-mono">
          <span className="tabular-nums">{d.time}</span>
          {event.venueName && (
            <>
              <span aria-hidden>·</span>
              <span>{event.venueName}</span>
            </>
          )}
          {event.city && (
            <>
              <span aria-hidden>·</span>
              <span>{event.city}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   Mainframe — VT100 / lo-fi terminal
   ============================================================ */
export function MainframeCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = (SOURCE_LABELS[event.source] ?? event.source).toUpperCase();
  return (
    <Link
      href={`/event/${event.id}`}
      className="group block bg-card transition-all hover:[text-shadow:0_0_8px_currentColor]"
      style={{ border: "1px solid currentColor" }}
    >
      <div className="px-3 py-1.5 border-b border-current text-[10px] uppercase tracking-[0.16em] flex items-center justify-between">
        <span>EVT.{event.id.slice(0, 6).toUpperCase()}</span>
        <span className="text-sunset">[{source}]</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="text-xs tabular-nums">
          ◆ {d.iso}
        </div>
        <h3 className="font-semibold text-base leading-tight text-balance">
          {"> "}{event.title}
        </h3>
        {event.description && (
          <p className="text-xs text-ink-soft text-pretty line-clamp-3">
            {event.description}
          </p>
        )}
        <div className="text-xs tabular-nums uppercase">
          {event.venueName && <div>LOC: {event.venueName}</div>}
          {event.city && <div>CITY: {event.city}</div>}
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   Glacier — Linear/Vercel cool techno
   ============================================================ */
export function GlacierCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const d = fmtDate(start);
  const source = SOURCE_LABELS[event.source] ?? event.source;
  return (
    <Link
      href={`/event/${event.id}`}
      className="group block rounded-lg bg-card ring-1 ring-ink/8 transition-all hover:ring-sunset-deep/40 hover:shadow-[0_8px_30px_-12px_oklch(0.55_0.2_220/0.25)] p-5"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block size-1.5 rounded-full bg-sunset-deep" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {source}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-soft">
          {d.weekday} {d.month} {d.day}
        </span>
      </div>
      <h3 className="font-semibold text-lg leading-snug text-balance group-hover:text-sunset-deep transition-colors -tracking-[0.01em]">
        {event.title}
      </h3>
      {event.description && (
        <p className="mt-2 text-sm text-ink-soft text-pretty line-clamp-2">
          {event.description}
        </p>
      )}
      <div className="mt-4 pt-3 border-t border-ink/8 flex items-center justify-between text-xs text-ink-soft">
        <span className="font-mono tabular-nums">{d.time}</span>
        <span className="truncate ml-3">
          {[event.venueName, event.city].filter(Boolean).join(" · ")}
        </span>
      </div>
    </Link>
  );
}
