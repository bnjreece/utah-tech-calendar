import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";
import {
  WasatchCard,
  ApartmentCard,
  MainframeCard,
  GlacierCard,
} from "./variant-cards";

interface VariantProps {
  events: EventWithGroup[];
  filterBarSlot: React.ReactNode;
  viewSlot: React.ReactNode;
  feedQuery: string;
}

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
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="font-display text-3xl tracking-tight">
            {events.length} ahead
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">ical</Link>
            <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">rss</Link>
            {viewSlot}
          </div>
        </div>
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <li key={e.id}><WasatchCard event={e} /></li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function ApartmentBlock({ events, filterBarSlot, viewSlot, feedQuery }: VariantProps) {
  return (
    <>
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-sunset-deep">
            Issue 01 · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
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
          <h2 className="font-display text-2xl tracking-tight italic">
            The Schedule
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            {events.length} entries
          </span>
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
      <section className="mx-auto max-w-6xl px-6 py-6">
        <pre className="text-xs sm:text-sm leading-tight overflow-x-auto" aria-hidden>
{`╔═══════════════════════════════════════════════════════════════╗
║  UTAH-TECH-EVENTS  v1.0                          STATUS: ONLINE║
║  ───────────────────────────────────────────────────────────── ║
║  Real, in-person Utah tech events. Online events filtered.    ║
╚═══════════════════════════════════════════════════════════════╝`}
        </pre>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-5 mt-6 border-b border-current pb-2">
          <h2 className="text-base uppercase tracking-[0.16em]">
            ▌ EVT.LIST · {events.length} REC
          </h2>
          <div className="flex items-center gap-4 text-xs uppercase tracking-wide">
            <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset">[ICAL]</Link>
            <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-sunset">[RSS]</Link>
            {viewSlot}
          </div>
        </div>
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((e) => (
            <li key={e.id}><MainframeCard event={e} /></li>
          ))}
        </ul>
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
            <h1 className="font-display text-3xl -tracking-[0.02em] font-semibold">
              Utah tech events
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Curated calendar of in-person gatherings across the state.
            </p>
          </div>
          <div className="flex items-baseline gap-6 font-mono text-xs tabular-nums text-ink-soft">
            <div>
              <div className="text-sunset-deep text-2xl font-medium leading-none">{events.length}</div>
              <div className="uppercase tracking-wide mt-1">upcoming</div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-2">{filterBarSlot}</section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="font-semibold text-lg -tracking-[0.01em]">
            All events
          </h2>
          <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-wide text-ink-soft">
            <Link href={`/api/ical${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-ink">ical</Link>
            <span aria-hidden>·</span>
            <Link href={`/api/rss${feedQuery ? `?${feedQuery}` : ""}`} className="hover:text-ink">rss</Link>
            {viewSlot}
          </div>
        </div>
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((e) => (
            <li key={e.id}><GlacierCard event={e} /></li>
          ))}
        </ul>
      </section>
    </>
  );
}
