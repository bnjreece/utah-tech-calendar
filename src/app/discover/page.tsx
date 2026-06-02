import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { getFeaturedVerticals } from "@/lib/tag-taxonomy";

export const metadata: Metadata = {
  title: "Discover Utah Tech",
  description:
    "Every in-person Utah tech event we can find, on one page. AI, fintech, biotech, healthtech, aerospace, cybersecurity, game dev, founders. No signup, no tracking, no profile.",
  alternates: { canonical: "/discover" },
  openGraph: {
    type: "website",
    title: `Discover Utah Tech · ${SITE_NAME}`,
    description:
      "A free, public, no-account-required calendar of every Utah tech event we can find. Stay on the pulse.",
    url: absoluteUrl("/discover"),
  },
};

/* Source pills as they appear in the flow diagram. Names match the
   actual scrape sources, ordered roughly by event volume. */
const SOURCES = [
  "Meetup",
  "Luma",
  "Eventbrite",
  "Silicon Slopes",
  "BioUtah",
  "47G",
  "Substack",
  "Submissions",
];

const STATS = [
  { value: "25+", label: "Sources watched" },
  { value: "9", label: "Curated verticals" },
  { value: "4", label: "Delivery channels" },
  { value: "0", label: "Accounts required" },
];

const VERTICALS = getFeaturedVerticals();

const CHANNELS = [
  {
    eyebrow: "01 — Calendar",
    title: "Pipe it into Apple or Google Calendar",
    note: "iCal subscription. Updates live as we scrape.",
  },
  {
    eyebrow: "02 — Email",
    title: "Monday morning, your filter",
    note: "Weekly digest of just the events you tagged.",
  },
  {
    eyebrow: "03 — RSS",
    title: "Read it in Feedly or NetNewsWire",
    note: "Same filters, syndicated.",
  },
  {
    eyebrow: "04 — Share link",
    title: "Send the filter to a friend",
    note: "Build a view, copy the URL. No signup on their end.",
  },
];

const FILTERED = [
  { kept: false, label: "PMP 4 Days Classroom Training", reason: "Cert-spam" },
  { kept: true, label: "Utah JS Meetup: TanStack Query patterns", reason: "Real meetup" },
  { kept: false, label: "Woodturning: Intro to Lathe Basics", reason: "Craft, not tech" },
  { kept: true, label: "Wilson Sonsini Medical Device Conference", reason: "Real conference" },
  { kept: false, label: "Cyber Security 1-Day Workshop x6 cities", reason: "Cross-post spam" },
  { kept: true, label: "Weekly AI Power Hour at Silicon Slopes", reason: "Real recurring meetup" },
];

const NEGATIVES = [
  { word: "Accounts", note: "Nothing to sign up for." },
  { word: "Tracking", note: "No pixels, no behavioral profile." },
  { word: "Cookie nag", note: "No tracking cookies to consent to." },
  { word: "Paywall", note: "Free, run as a public service." },
];

export default function DiscoverPage() {
  return (
    <div className="theme-editorial">
      {/* ============================================================
          HERO — quiet, editorial, the thesis in two lines
          ============================================================ */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
          Discover Utah Tech
        </p>
        <h1
          className="mt-5 font-display italic tracking-tight text-ink leading-[1.02] text-balance text-[44px] sm:text-[72px] lg:text-[88px]"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
        >
          You don&apos;t know <br className="hidden sm:block" />
          what you don&apos;t know.
        </h1>
        <p className="mt-8 max-w-[58ch] text-lg sm:text-xl text-ink-soft leading-relaxed text-pretty">
          A map of the in-person Utah tech and tech-adjacent scene.
          Founders, designers, scientists, operators, anyone building
          here. One page, no signup.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-sunset-deep transition-colors"
          >
            Open the schedule
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/subscribe"
            className="inline-flex items-center gap-2 rounded-full ring-1 ring-ink/25 px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper-deep transition-colors"
          >
            Build your view
          </Link>
        </div>
      </section>

      {/* ============================================================
          STATS RIBBON — quick proof-of-shape
          ============================================================ */}
      <section className="border-y border-ink/15 bg-paper-deep/40">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-6">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  {s.label}
                </dt>
                <dd
                  className="font-display italic tracking-tight text-ink text-4xl sm:text-5xl tabular-nums"
                  style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================================================
          FLOW DIAGRAM — the whole product in one image
          ============================================================ */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-baseline justify-between gap-6 flex-wrap mb-10">
          <h2
            className="font-display italic tracking-tight text-ink text-3xl sm:text-4xl"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            How the map gets drawn.
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Figure 1
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-y-8 gap-x-6 items-center">
          {/* Column 1 — sources */}
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
              01 · Sources
            </p>
            <div className="rounded-2xl bg-paper-deep p-5 ring-1 ring-ink/10">
              <ul className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <li
                    key={s}
                    className="inline-flex items-center rounded-full bg-paper px-3 py-1 text-xs font-mono uppercase tracking-[0.16em] text-ink-soft ring-1 ring-ink/10"
                  >
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-soft text-pretty">
                Calendars, listing sites, organizer pages, the
                inbox. Scattered.
              </p>
            </div>
          </div>

          <FlowArrow className="hidden lg:block" />

          {/* Column 2 — filter */}
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusk-deep">
              02 · Curation
            </p>
            <div className="rounded-2xl bg-ink text-paper p-5">
              <p
                className="font-display italic tracking-tight leading-[1.1] text-2xl"
                style={{
                  fontFamily: "Fraunces, ui-serif, Georgia, serif",
                }}
              >
                In-person, real, Utah, tech.
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-xs font-mono uppercase tracking-[0.18em] text-paper/70">
                <li>· cert-spam filtered</li>
                <li>· craft cross-posts dropped</li>
                <li>· dupes deduped</li>
                <li>· verticals tagged</li>
              </ul>
            </div>
          </div>

          <FlowArrow className="hidden lg:block" />

          {/* Column 3 — output */}
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
              03 · One schedule
            </p>
            <div className="rounded-2xl bg-paper-deep p-5 ring-1 ring-ink/10 flex flex-col gap-2">
              {[
                { d: "Mon", t: "Founders dinner · Lehi" },
                { d: "Wed", t: "Utah JS · SLC" },
                { d: "Thu", t: "BioHive demo day" },
                { d: "Fri", t: "AI Power Hour" },
              ].map((row) => (
                <div
                  key={row.d}
                  className="flex items-baseline gap-3 border-b border-ink/10 last:border-0 pb-2 last:pb-0"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft w-8">
                    {row.d}
                  </span>
                  <span className="text-sm text-ink">{row.t}</span>
                </div>
              ))}
              <p className="mt-2 text-xs font-mono uppercase tracking-[0.18em] text-ink-soft">
                + 170 more this season
              </p>
            </div>
          </div>

          {/* Mobile arrows */}
          <div className="lg:hidden flex justify-center text-ink-soft">
            <FlowArrow vertical />
          </div>
        </div>
      </section>

      {/* ============================================================
          WHAT IN / WHAT OUT — visible curation
          ============================================================ */}
      <section className="border-t border-ink/15 bg-paper-deep/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex items-baseline justify-between gap-6 flex-wrap mb-10">
            <h2
              className="font-display italic tracking-tight text-ink text-3xl sm:text-4xl"
              style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
            >
              What gets in, what doesn&apos;t.
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              A working sample
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FILTERED.map((row) => (
              <li
                key={row.label}
                className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ring-1 ${
                  row.kept
                    ? "bg-paper ring-ink/12"
                    : "bg-paper/40 ring-ink/8 line-through decoration-1 decoration-ink/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1 font-mono text-base ${
                    row.kept ? "text-sage-deep" : "text-sunset-deep"
                  }`}
                >
                  {row.kept ? "✓" : "✗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink text-pretty leading-snug">
                    {row.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    {row.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          VERTICALS — visual chip mosaic, deep links
          ============================================================ */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-baseline justify-between gap-6 flex-wrap mb-8">
          <h2
            className="font-display italic tracking-tight text-ink text-3xl sm:text-4xl"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            Drop into a vertical.
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Each one is its own page
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {VERTICALS.map((v) => (
            <Link
              key={v.tag}
              href={`/tag/${v.tag}`}
              className="group flex flex-col gap-2 rounded-2xl border border-ink/12 bg-paper p-4 transition-colors hover:border-ink/35"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft group-hover:text-sunset-deep transition-colors">
                /tag/{v.tag}
              </span>
              <span
                className="font-display text-xl italic tracking-tight text-ink leading-tight"
                style={{
                  fontFamily: "Fraunces, ui-serif, Georgia, serif",
                }}
              >
                {v.display}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================================
          CHANNELS — 4 delivery surfaces
          ============================================================ */}
      <section className="border-t border-ink/15 bg-paper-deep/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex items-baseline justify-between gap-6 flex-wrap mb-10">
            <h2
              className="font-display italic tracking-tight text-ink text-3xl sm:text-4xl"
              style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
            >
              Four ways to stay on it.
            </h2>
            <Link
              href="/subscribe"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep hover:underline decoration-1 underline-offset-4"
            >
              Set one up →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CHANNELS.map((c) => (
              <div
                key={c.eyebrow}
                className="rounded-2xl bg-paper p-5 ring-1 ring-ink/10 flex flex-col gap-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sunset-deep">
                  {c.eyebrow}
                </p>
                <h3
                  className="font-display italic tracking-tight text-ink text-lg leading-snug"
                  style={{
                    fontFamily: "Fraunces, ui-serif, Georgia, serif",
                  }}
                >
                  {c.title}
                </h3>
                <p className="text-xs text-ink-soft text-pretty leading-relaxed">
                  {c.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          WHAT WE DON'T DO — 4 negative chips
          ============================================================ */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
        <h2
          className="font-display italic tracking-tight text-ink text-3xl sm:text-4xl mb-10"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
        >
          What we don&apos;t do.
        </h2>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NEGATIVES.map((n) => (
            <li
              key={n.word}
              className="rounded-2xl ring-1 ring-ink/15 px-4 py-5 flex flex-col items-start gap-2"
            >
              <span
                aria-hidden
                className="font-mono text-[14px] text-sunset-deep"
              >
                ✗
              </span>
              <span
                className="font-display italic tracking-tight text-ink text-xl leading-tight"
                style={{
                  fontFamily: "Fraunces, ui-serif, Georgia, serif",
                }}
              >
                {n.word}
              </span>
              <span className="text-xs text-ink-soft leading-relaxed text-pretty">
                {n.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ============================================================
          CTA — anyone can submit
          ============================================================ */}
      <section className="border-t border-ink/15 bg-paper-deep/40">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Anyone can contribute
          </p>
          <h2
            className="mt-5 font-display italic tracking-tight text-ink text-3xl sm:text-5xl leading-[1.05] max-w-[20ch] mx-auto"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            Know an event we don&apos;t? Tell us.
          </h2>
          <p className="mt-5 max-w-[52ch] mx-auto text-base text-ink-soft text-pretty leading-relaxed">
            Submissions go straight to the moderation queue. Or
            send us a whole source - a Meetup group, a Luma
            calendar, an org we haven&apos;t found yet.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-sunset-deep transition-colors"
            >
              Submit an event
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:b@bnjmn.org?subject=Utah%20Tech%20Calendar%3A%20new%20source"
              className="inline-flex items-center gap-2 rounded-full ring-1 ring-ink/25 px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper-deep transition-colors"
            >
              Suggest a source
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          PRINCIPLE — one-line signoff
          ============================================================ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-20 text-center">
        <p
          className="font-display italic tracking-tight text-ink text-2xl sm:text-3xl leading-relaxed text-balance"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
        >
          Word-of-mouth is a beautiful signal at one table. A
          terrible one across a scene. We&apos;re drawing the map so
          it&apos;s easier to find each other.
        </p>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          <Link href="/" className="hover:text-ink transition-colors">
            ← back to the schedule
          </Link>
        </p>
      </section>
    </div>
  );
}

/* Inline SVG arrow used in the flow diagram. Horizontal by default,
   vertical for the mobile stacking. Picks up currentColor so it
   inherits ink-soft from the parent. */
function FlowArrow({
  vertical = false,
  className = "",
}: {
  vertical?: boolean;
  className?: string;
}) {
  if (vertical) {
    return (
      <svg
        width="14"
        height="32"
        viewBox="0 0 14 32"
        className={className}
        aria-hidden
      >
        <path
          d="M7 0v26m-6-6l6 6 6-6"
          stroke="currentColor"
          strokeWidth="1.25"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="32"
      height="14"
      viewBox="0 0 32 14"
      className={`text-ink-soft ${className}`}
      aria-hidden
    >
      <path
        d="M0 7h26m-6-6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
