import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";
import {
  WasatchCard,
  ApartmentCard,
  MainframeCard,
  GlacierCard,
  EditorialStripCard,
  EditorialLinearCard,
} from "./variant-cards";

interface VariantProps {
  events: EventWithGroup[];
  filterBarSlot: React.ReactNode;
  viewSlot: React.ReactNode;
  feedQuery: string;
}

/* ============================================================
   Editorial — the locked direction.
   Used by all 4 final picker combos with different fonts/cards.
   ============================================================ */
function EditorialMasthead({ events }: { events: EventWithGroup[] }) {
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <section className="border-b-2 border-ink">
      <div className="mx-auto max-w-5xl px-6 pt-14 pb-10">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            № 1 · {month} · curated weekly
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            cottonwood heights, ut
          </span>
        </div>
        <h1 className="mt-8 font-display text-[clamp(3.25rem,9vw,6.75rem)] leading-[0.92] -tracking-[0.025em] text-balance text-ink">
          utah tech <span className="italic">events</span>
        </h1>
        <p className="mt-6 max-w-[58ch] text-pretty text-base sm:text-lg text-ink-soft font-display italic leading-relaxed">
          A periodical of in-person tech gatherings throughout the state. Editorially curated. Filed by region, host, and stack.
        </p>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
          filed {events.length} entries · across 5 regions · online events filtered
        </p>
      </div>
    </section>
  );
}

function EditorialFooterLinks({ feedQuery, viewSlot }: { feedQuery: string; viewSlot: React.ReactNode }) {
  return (
    <div className="mt-12 pt-6 border-t border-ink/15 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
      <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset-deep hover:underline underline-offset-4">
        subscribe ical
      </Link>
      <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset-deep hover:underline underline-offset-4">
        rss
      </Link>
      <Link href="/submit" className="hover:text-sunset-deep hover:underline underline-offset-4">
        submit an event
      </Link>
      <span aria-hidden className="text-ink/20">·</span>
      {viewSlot}
    </div>
  );
}

export function EditorialStripBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <EditorialMasthead events={events} />
      <section className="mx-auto max-w-5xl px-6 py-8">{filterBarSlot}</section>
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mt-4 mb-2 pb-3 border-b-2 border-ink flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl tracking-tight italic">The Schedule</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            {events.length} entries
          </span>
        </div>
        <ul role="list" className="flex flex-col">
          {events.map((e) => (
            <li key={e.id}><EditorialStripCard event={e} /></li>
          ))}
        </ul>
        <EditorialFooterLinks feedQuery={feedQuery} viewSlot={viewSlot} />
      </section>
    </>
  );
}

interface DayGroup {
  key: string;
  date: Date;
  events: EventWithGroup[];
}

function groupEventsByDay(events: EventWithGroup[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(e);
    } else {
      groups.set(key, { key, date: d, events: [e] });
    }
  }
  return Array.from(groups.values());
}

export function EditorialLinearBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dayGroups = groupEventsByDay(events);

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 pb-16">
        <div className="pb-3 border-b-2 border-ink flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight italic">
            The Schedule
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft tabular-nums">
            {events.length} entries · {month}
          </span>
        </div>

        <div className="flex flex-col">
          {dayGroups.map((group, i) => {
            const prev = i > 0 ? dayGroups[i - 1] : null;
            const monthChanged =
              prev !== null && prev.date.getMonth() !== group.date.getMonth();
            const isFirst = i === 0;
            const weekday = group.date.toLocaleDateString("en-US", { weekday: "long" });
            const monthName = group.date.toLocaleDateString("en-US", { month: "long" });
            const dayNum = group.date.getDate();
            const monthBannerLabel = monthName.toUpperCase();

            return (
              <div key={group.key}>
                {monthChanged && (
                  <div
                    aria-hidden
                    className="mt-16 mb-12 flex items-center gap-6"
                  >
                    <span className="h-px flex-1 bg-ink/25" />
                    <span className="font-display text-xs uppercase tracking-[0.5em] text-ink/65">
                      {monthBannerLabel}
                    </span>
                    <span className="h-px flex-1 bg-ink/25" />
                  </div>
                )}
                <h3
                  className={`font-display italic text-2xl sm:text-3xl text-ink mb-3 ${
                    isFirst ? "mt-8" : monthChanged ? "mt-0" : "mt-12"
                  }`}
                >
                  {weekday}, {monthName} {dayNum}
                </h3>
                <ul role="list" className="flex flex-col">
                  {group.events.map((e) => (
                    <li key={e.id}>
                      <EditorialLinearCard event={e} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <EditorialFooterLinks feedQuery={feedQuery} viewSlot={viewSlot} />
      </section>
    </>
  );
}

/* ============================================================
   Pre-existing variants kept for back-compat; not in active picker
   ============================================================ */
export function WasatchBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <section className="border-y border-ink/10 bg-paper-deep/40">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
          <span>Wasatch front · 40.76° N · 111.89° W</span>
          <span>elev 4,330 ft · {events.length} events</span>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <li key={e.id}><WasatchCard event={e} /></li>
          ))}
        </ul>
        <div className="mt-6 flex gap-4 text-sm">
          <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="text-ink-soft hover:text-ink">ical</Link>
          <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="text-ink-soft hover:text-ink">rss</Link>
          {viewSlot}
        </div>
      </section>
    </>
  );
}

export function ApartmentBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-sunset-deep">
          Issue 01 · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <h1 className="mt-6 font-display text-[clamp(3.5rem,9vw,7rem)] leading-[0.92] tracking-[-0.02em] text-balance">
          Utah Tech <span className="italic">Quarterly</span>
        </h1>
        <p className="mt-6 max-w-[58ch] text-pretty text-lg text-ink-soft font-display italic leading-relaxed">
          A periodical of in-person tech gatherings throughout the state. Editorially curated. Filed by region, host, and stack.
        </p>
      </section>
      <section className="mx-auto max-w-5xl px-6 pb-4">{filterBarSlot}</section>
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-2 mt-8 pb-2 border-b-2 border-ink">
          <h2 className="font-display text-2xl tracking-tight italic">The Schedule</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">{events.length} entries</span>
        </div>
        <ul role="list" className="flex flex-col">
          {events.map((e) => (
            <li key={e.id}><ApartmentCard event={e} /></li>
          ))}
        </ul>
        <div className="mt-12 flex items-center gap-6 text-sm font-mono uppercase tracking-wide text-ink-soft">
          <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-ink">subscribe ical</Link>
          <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-ink">rss</Link>
          {viewSlot}
        </div>
      </section>
    </>
  );
}

export function MainframeBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <section className="border-b border-current">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between text-xs uppercase tracking-[0.16em]">
          <span>UTE-NET // SYS.READY</span>
          <span className="text-sunset">[{events.length} EVT QUEUED]</span>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((e) => (
            <li key={e.id}><MainframeCard event={e} /></li>
          ))}
        </ul>
        <div className="mt-6 flex gap-4 text-xs uppercase">
          <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset">[ICAL]</Link>
          <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset">[RSS]</Link>
          {viewSlot}
        </div>
      </section>
    </>
  );
}

export function GlacierBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <section className="border-b border-ink/8">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-baseline justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-display text-3xl -tracking-[0.02em] font-semibold">Utah tech events</h1>
            <p className="mt-1 text-sm text-ink-soft">Curated calendar of in-person gatherings across the state.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((e) => (
            <li key={e.id}><GlacierCard event={e} /></li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3 text-xs">
          <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="text-ink-soft hover:text-ink">ical</Link>
          <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="text-ink-soft hover:text-ink">rss</Link>
          {viewSlot}
        </div>
      </section>
    </>
  );
}
