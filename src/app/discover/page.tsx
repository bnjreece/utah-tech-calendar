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
          FLOW DIAGRAM — illustrated editorial figure
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-baseline justify-between gap-6 flex-wrap mb-2">
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
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-10">
          From scatter, through curation, into schedule.
        </p>

        <Figure1 />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-ink-soft">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
              01 · Sources
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              Calendars, listing sites, organizer pages, the
              inbox. Scattered, unsorted, unread.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusk-deep">
              02 · Curation
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              In-person, real, Utah, tech. Cert-spam out,
              craft out, dupes deduped, verticals tagged.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
              03 · One schedule
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              Ordered, dated, tagged, shareable. Same
              data, every channel.
            </p>
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

/* Illustrated editorial figure for the "How the map gets drawn"
   section. Three-part visual narrative rendered as one SVG so the
   threadlines actually connect across the panels:
   - LEFT: chaotic scatter of source nodes. Some labeled, some
     anonymous, a few struck-through (sources we reject upfront).
     Connector threads curve toward the center.
   - MIDDLE: a thin vertical pinch labeled "curation." Threads
     thread through the pinch; rejection markers ✗ float around it.
   - RIGHT: threads emerge organized, landing on a horizontal grid
     of dated event rows.
   Stroke widths and Y-offsets are hand-placed for a "deliberate but
   not perfect" feel. The figure uses the existing stratum tokens so
   it picks up dark-mode automatically. */
function Figure1() {
  /* Source labels along the left scatter. Position is roughly y%
     across the left third (x: 60-380, y: 60-540 in viewBox). */
  const sources = [
    { x: 110, y: 90, r: 4, label: "MEETUP", angle: -2 },
    { x: 250, y: 70, r: 5, label: "LUMA", angle: 1 },
    { x: 70, y: 200, r: 3, label: null, angle: 0 },
    { x: 320, y: 140, r: 4, label: "SILICON SLOPES", angle: 2 },
    { x: 150, y: 230, r: 6, label: "EVENTBRITE", angle: 1 },
    { x: 60, y: 320, r: 3, label: null, angle: 0 },
    { x: 290, y: 270, r: 4, label: "47G", angle: -1 },
    { x: 180, y: 340, r: 5, label: "BIOUTAH", angle: 1 },
    { x: 100, y: 420, r: 3, label: null, angle: 0 },
    { x: 230, y: 420, r: 4, label: "SUBSTACK", angle: -1 },
    { x: 340, y: 380, r: 3, label: null, angle: 0 },
    { x: 150, y: 500, r: 5, label: "SUBMISSIONS", angle: 1 },
    { x: 60, y: 500, r: 3, label: null, angle: 0 },
  ];

  /* A subset of sources get connector threads to the pinch
     (x=620, y varies). The rest are noise/scatter. */
  const threadIndices = [0, 1, 3, 4, 6, 7, 9, 11];
  /* Rejected things - mark them with X near them, don't draw a thread. */
  const rejected = [
    { x: 65, y: 145, label: "CERT-SPAM" },
    { x: 360, y: 320, label: "CRAFT" },
    { x: 80, y: 370, label: "DUPE" },
  ];

  /* Pinch column on the right side of the curation lens. Threads
     emerge from x=640 at staggered Y positions and reach to x=1140
     (end of viewBox). */
  const outputRows = [
    { y: 130, day: "MON", label: "Founders dinner · Lehi" },
    { y: 210, day: "WED", label: "Utah JS · SLC" },
    { y: 290, day: "THU", label: "BioHive demo day" },
    { y: 370, day: "FRI", label: "AI Power Hour · Silicon Slopes" },
    { y: 450, day: "SAT", label: "SAINTCON · Provo" },
  ];

  return (
    <div className="relative">
      <svg
        viewBox="0 0 1200 600"
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Diagram: scattered source nodes thread through a curation pinch and emerge as an organized schedule grid."
      >
        {/* Subtle dotted grid across the whole figure - editorial
            "graph paper" texture without being a literal grid. */}
        <defs>
          <pattern
            id="dots"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" opacity="0.18" />
          </pattern>
          <linearGradient id="threadFade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="48%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="52%" stopColor="currentColor" stopOpacity="0.65" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <rect
          x="0"
          y="0"
          width="1200"
          height="600"
          fill="url(#dots)"
          className="text-ink-soft"
        />

        {/* SCATTER (LEFT): source nodes with floating labels. */}
        <g className="text-ink-soft">
          {sources.map((s, i) => (
            <g key={`src-${i}`}>
              <circle
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill="currentColor"
                opacity="0.75"
              />
              {s.label && (
                <text
                  x={s.x + s.r + 8}
                  y={s.y + 3}
                  fontSize="9"
                  fontFamily="IBM Plex Mono, ui-monospace, monospace"
                  letterSpacing="0.12em"
                  fill="currentColor"
                  className="text-ink"
                  transform={`rotate(${s.angle} ${s.x + s.r + 8} ${s.y + 3})`}
                >
                  {s.label}
                </text>
              )}
            </g>
          ))}

          {/* Tiny chaos sprinkles - dots that aren't sources, give
              the field texture. */}
          {Array.from({ length: 28 }).map((_, i) => {
            /* Stable pseudo-random via index. */
            const seed = i * 137.508;
            const x = 30 + ((seed * 7) % 380);
            const y = 40 + ((seed * 11) % 540);
            const r = 0.8 + ((seed * 3) % 1.2);
            return (
              <circle
                key={`sprinkle-${i}`}
                cx={x}
                cy={y}
                r={r}
                fill="currentColor"
                opacity="0.25"
              />
            );
          })}
        </g>

        {/* REJECTED items - X marks with mono label */}
        <g className="text-sunset-deep">
          {rejected.map((r, i) => (
            <g key={`rej-${i}`} opacity="0.55">
              <line
                x1={r.x - 5}
                y1={r.y - 5}
                x2={r.x + 5}
                y2={r.y + 5}
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <line
                x1={r.x - 5}
                y1={r.y + 5}
                x2={r.x + 5}
                y2={r.y - 5}
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <text
                x={r.x + 10}
                y={r.y + 3}
                fontSize="8"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
                letterSpacing="0.14em"
                fill="currentColor"
              >
                {r.label}
              </text>
            </g>
          ))}
        </g>

        {/* THREADS: bezier curves from source nodes to the pinch.
            Each thread is its own gentle S-curve. */}
        <g className="text-ink" fill="none">
          {threadIndices.map((srcIdx, i) => {
            const s = sources[srcIdx];
            const targetY = 100 + (i / (threadIndices.length - 1)) * 400;
            const ctrl1X = 380;
            const ctrl1Y = s.y;
            const ctrl2X = 480;
            const ctrl2Y = targetY;
            const endX = 600;
            const endY = targetY;
            return (
              <path
                key={`thread-${i}`}
                d={`M ${s.x + s.r} ${s.y} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`}
                stroke="url(#threadFade)"
                strokeWidth={1 + (i % 3) * 0.25}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* PINCH: the curation slit. Thin vertical bar with a small
            label below. Threads enter at x=600 and exit at x=640. */}
        <g>
          <line
            x1="610"
            y1="80"
            x2="610"
            y2="520"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink"
            opacity="0.85"
          />
          <line
            x1="625"
            y1="80"
            x2="625"
            y2="520"
            stroke="currentColor"
            strokeWidth="1"
            className="text-dusk-deep"
            opacity="0.65"
          />
          {/* Filter labels stacked beside the pinch */}
          <g className="text-dusk-deep">
            <text
              x="600"
              y="60"
              fontSize="10"
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
              letterSpacing="0.22em"
              fill="currentColor"
              textAnchor="middle"
            >
              CURATION
            </text>
          </g>
          {/* Tick marks along the pinch suggest the filter passes */}
          <g className="text-ink-soft">
            {[120, 180, 240, 300, 360, 420, 480].map((y, i) => (
              <line
                key={`tick-${i}`}
                x1="606"
                y1={y}
                x2="614"
                y2={y}
                stroke="currentColor"
                strokeWidth="1.25"
                opacity="0.7"
              />
            ))}
          </g>
        </g>

        {/* OUTPUT THREADS: emerge from pinch and run to schedule rows */}
        <g className="text-ink" fill="none">
          {outputRows.map((row, i) => {
            const startY = 100 + (i / (outputRows.length - 1)) * 400;
            return (
              <path
                key={`out-${i}`}
                d={`M 640 ${startY} C 720 ${startY}, 760 ${row.y}, 840 ${row.y}`}
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                opacity="0.55"
              />
            );
          })}
        </g>

        {/* SCHEDULE GRID (RIGHT): 5 horizontal lines with day chip +
            event title floating at the row. */}
        <g>
          {outputRows.map((row, i) => (
            <g key={`row-${i}`}>
              {/* baseline */}
              <line
                x1="840"
                y1={row.y}
                x2="1150"
                y2={row.y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-ink-soft"
                opacity="0.4"
              />
              {/* day chip */}
              <text
                x="848"
                y={row.y - 6}
                fontSize="9"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
                letterSpacing="0.2em"
                fill="currentColor"
                className="text-ink-soft"
              >
                {row.day}
              </text>
              {/* event title */}
              <text
                x="900"
                y={row.y - 6}
                fontSize="13"
                fontFamily="Fraunces, ui-serif, Georgia, serif"
                fontStyle="italic"
                fill="currentColor"
                className="text-ink"
              >
                {row.label}
              </text>
              {/* terminal dot - sage accent */}
              <circle
                cx="845"
                cy={row.y}
                r="3.5"
                fill="currentColor"
                className="text-sage-deep"
              />
            </g>
          ))}
          {/* footer count */}
          <text
            x="845"
            y="530"
            fontSize="9"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            letterSpacing="0.2em"
            fill="currentColor"
            className="text-ink-soft"
          >
            + 170 MORE THIS SEASON
          </text>
        </g>

        {/* Edge labels - subtle markers at the top of each band */}
        <g className="text-ink-soft" opacity="0.55">
          <text
            x="60"
            y="40"
            fontSize="9"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            letterSpacing="0.22em"
            fill="currentColor"
          >
            CHAOS
          </text>
          <text
            x="1140"
            y="40"
            fontSize="9"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            letterSpacing="0.22em"
            fill="currentColor"
            textAnchor="end"
          >
            ORDER
          </text>
        </g>
      </svg>
    </div>
  );
}
