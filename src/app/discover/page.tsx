import type { Metadata } from "next";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db, sources } from "@/lib/db";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { getFeaturedVerticals } from "@/lib/tag-taxonomy";
import { ForgeCredit } from "@/components/forge-credit";

/* Re-render hourly so the live source count stays accurate without a
   DB hit on every visit. The stat used to be a hardcoded "25+" that
   drifted badly as sources grew (real count is ~59). */
export const revalidate = 3600;

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

const VERTICALS = getFeaturedVerticals();

/* Live enabled-source count. Dynamic (with hourly revalidate) so it
   stays exact as sources are added, instead of the old stale "25+". */
async function sourcesWatchedValue(): Promise<string> {
  try {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(sources)
      .where(eq(sources.enabled, true));
    return String(row?.c ?? 0);
  } catch {
    return "50+";
  }
}

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

export default async function DiscoverPage() {
  const STATS = [
    { value: await sourcesWatchedValue(), label: "Sources watched" },
    { value: String(VERTICALS.length), label: "Curated verticals" },
    { value: "4", label: "Delivery channels" },
    { value: "0", label: "Accounts required" },
  ];
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
          An index of the in-person Utah tech and tech-adjacent scene.
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
            How the index gets built.
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Figure 1
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-10">
          Many shapes in, one ontology out.
        </p>

        <Figure1 />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-ink-soft">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
              01 · Sources
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              Calendars, listing sites, organizer pages, the
              inbox. Scattered shapes, scattered schemas,
              scattered signal.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
              02 · Refinement
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              Cert-spam out, craft out, dupes deduped,
              webinars flagged, past placeholders sunset.
              The cleanup pass.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusk-deep">
              03 · Ontology
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              One schema across thirteen sources. Verticals
              tagged, regions placed, formats labeled. So
              every event is queryable in the same vocabulary.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
              04 · One schedule
            </p>
            <p className="mt-2 text-pretty leading-relaxed">
              Scannable in one read. &ldquo;What&apos;s the AI thing
              in Lehi on Thursday?&rdquo; answers itself.
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
          terrible one across a scene. We&apos;re building the index so
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

/* Illustrated editorial figure for the "How the index gets built"
   section. Four-stage visual narrative rendered as one SVG so the
   threadlines connect across the whole pipeline:
   - LEFT: chaotic scatter of source nodes. Some labeled, some
     anonymous, with surrounding noise.
   - PINCH 1 ("REFINEMENT"): the cleanup pass. Threads enter, junk
     (cert-spam, craft, dupes, webinars) gets cut off with X marks.
   - PINCH 2 ("ONTOLOGY"): the classification pass. Surviving threads
     get color-coded with small vertical chips (ai, biotech, fintech,
     founders, etc) as they pass through.
   - RIGHT: threads land on a horizontal schedule grid of dated rows.
   Stroke widths and Y-offsets are hand-placed for a "deliberate but
   not perfect" feel. Uses stratum tokens so dark mode inherits. */
function Figure1() {
  /* Source nodes scattered across the left third (x: 30-330,
     y: 60-540 in viewBox). */
  const sources = [
    { x: 90, y: 90, r: 4, label: "MEETUP", angle: -2 },
    { x: 220, y: 70, r: 5, label: "LUMA", angle: 1 },
    { x: 50, y: 180, r: 3, label: null, angle: 0 },
    { x: 280, y: 140, r: 4, label: "SILICON SLOPES", angle: 2 },
    { x: 130, y: 220, r: 6, label: "EVENTBRITE", angle: 1 },
    { x: 40, y: 290, r: 3, label: null, angle: 0 },
    { x: 260, y: 240, r: 4, label: "47G", angle: -1 },
    { x: 160, y: 320, r: 5, label: "BIOUTAH", angle: 1 },
    { x: 80, y: 380, r: 3, label: null, angle: 0 },
    { x: 210, y: 380, r: 4, label: "SUBSTACK", angle: -1 },
    { x: 300, y: 340, r: 3, label: null, angle: 0 },
    { x: 130, y: 460, r: 5, label: "SUBMISSIONS", angle: 1 },
    { x: 50, y: 450, r: 3, label: null, angle: 0 },
    { x: 290, y: 460, r: 3, label: null, angle: 0 },
  ];

  /* Threads enter PINCH 1 (refinement) at x=440. Each survives or
     gets rejected. Survivors continue to PINCH 2 (ontology) at x=620
     where they pick up a vertical tag. */
  const threads = [
    { srcIdx: 0,  midY: 100, ok: true,  tag: { color: "text-sunset-deep", label: "FOUNDERS" } },
    { srcIdx: 1,  midY: 150, ok: true,  tag: { color: "text-sage-deep", label: "DEVOPS" } },
    { srcIdx: 4,  midY: 200, ok: false, rejection: "CERT-SPAM" },
    { srcIdx: 3,  midY: 240, ok: true,  tag: { color: "text-dusk-deep", label: "AI" } },
    { srcIdx: 6,  midY: 290, ok: true,  tag: { color: "text-terracotta-deep", label: "AEROSPACE" } },
    { srcIdx: 7,  midY: 340, ok: true,  tag: { color: "text-sage-deep", label: "BIOTECH" } },
    { srcIdx: 8,  midY: 380, ok: false, rejection: "CRAFT" },
    { srcIdx: 9,  midY: 420, ok: true,  tag: { color: "text-dusk-deep", label: "FINTECH" } },
    { srcIdx: 11, midY: 470, ok: true,  tag: { color: "text-sunset-deep", label: "MEETUP" } },
  ];

  /* Pinch X positions */
  const P1 = 440;
  const P2 = 660;
  /* Output schedule rows on the right */
  const outputRows = [
    { y: 110, day: "MON", label: "Founders dinner · Lehi" },
    { y: 200, day: "WED", label: "Utah JS · SLC" },
    { y: 290, day: "THU", label: "BioHive demo day" },
    { y: 380, day: "FRI", label: "AI Power Hour · Silicon Slopes" },
    { y: 470, day: "SAT", label: "SAINTCON · Provo" },
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

        {/* THREADS — IN (source → P1): bezier from source node to
            the refinement pinch. Each thread is one item flowing
            through the pipeline. */}
        <g className="text-ink" fill="none">
          {threads.map((t, i) => {
            const s = sources[t.srcIdx];
            return (
              <path
                key={`in-${i}`}
                d={`M ${s.x + s.r} ${s.y} C 320 ${s.y}, 380 ${t.midY}, ${P1} ${t.midY}`}
                stroke="url(#threadFade)"
                strokeWidth={1 + (i % 3) * 0.25}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* PINCH 1 — REFINEMENT. Thin vertical bar with sunset accent.
            Rejection X's float just past it for threads that don't
            survive. */}
        <g>
          <line
            x1={P1}
            y1="80"
            x2={P1}
            y2="520"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink"
            opacity="0.85"
          />
          <line
            x1={P1 + 12}
            y1="80"
            x2={P1 + 12}
            y2="520"
            stroke="currentColor"
            strokeWidth="1"
            className="text-sunset-deep"
            opacity="0.65"
          />
          <text
            x={P1 + 6}
            y="60"
            fontSize="10"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            letterSpacing="0.22em"
            fill="currentColor"
            textAnchor="middle"
            className="text-sunset-deep"
          >
            REFINEMENT
          </text>
          {/* Tick marks along the pinch */}
          <g className="text-ink-soft">
            {threads.map((t, i) => (
              <line
                key={`p1-tick-${i}`}
                x1={P1 - 4}
                y1={t.midY}
                x2={P1 + 16}
                y2={t.midY}
                stroke="currentColor"
                strokeWidth="1.25"
                opacity="0.5"
              />
            ))}
          </g>
        </g>

        {/* REJECTIONS at PINCH 1 — X marks just past it for threads
            that don't survive the cleanup pass. */}
        <g className="text-sunset-deep">
          {threads
            .filter((t) => !t.ok)
            .map((t, i) => {
              const x = P1 + 30;
              const y = t.midY;
              return (
                <g key={`rej-${i}`} opacity="0.75">
                  <line
                    x1={x - 5}
                    y1={y - 5}
                    x2={x + 5}
                    y2={y + 5}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={x - 5}
                    y1={y + 5}
                    x2={x + 5}
                    y2={y - 5}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <text
                    x={x + 10}
                    y={y + 3}
                    fontSize="8"
                    fontFamily="IBM Plex Mono, ui-monospace, monospace"
                    letterSpacing="0.14em"
                    fill="currentColor"
                  >
                    {t.rejection}
                  </text>
                </g>
              );
            })}
        </g>

        {/* THREADS — MID (P1 → P2): surviving threads run from
            refinement to ontology, staying at the same Y. */}
        <g fill="none">
          {threads
            .filter((t) => t.ok)
            .map((t, i) => (
              <path
                key={`mid-${i}`}
                d={`M ${P1 + 12} ${t.midY} L ${P2} ${t.midY}`}
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                opacity="0.55"
                className="text-ink"
              />
            ))}
        </g>

        {/* PINCH 2 — ONTOLOGY. Thin vertical bar with dusk accent +
            small vertical tag chips emerging at each thread's Y. */}
        <g>
          <line
            x1={P2}
            y1="80"
            x2={P2}
            y2="520"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink"
            opacity="0.85"
          />
          <line
            x1={P2 + 12}
            y1="80"
            x2={P2 + 12}
            y2="520"
            stroke="currentColor"
            strokeWidth="1"
            className="text-dusk-deep"
            opacity="0.65"
          />
          <text
            x={P2 + 6}
            y="60"
            fontSize="10"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            letterSpacing="0.22em"
            fill="currentColor"
            textAnchor="middle"
            className="text-dusk-deep"
          >
            ONTOLOGY
          </text>
        </g>

        {/* Tag chips emerge from PINCH 2 — small pill labels in the
            tag's accent color, attached to each surviving thread. */}
        <g>
          {threads
            .filter((t) => t.ok)
            .map((t, i) => {
              if (!t.tag) return null;
              const chipX = P2 + 20;
              const chipY = t.midY;
              const labelLen = t.tag.label.length;
              const chipW = labelLen * 5.5 + 12;
              return (
                <g key={`tag-${i}`} className={t.tag.color}>
                  <rect
                    x={chipX}
                    y={chipY - 7}
                    width={chipW}
                    height="14"
                    rx="7"
                    fill="currentColor"
                    opacity="0.15"
                  />
                  <text
                    x={chipX + chipW / 2}
                    y={chipY + 2.5}
                    fontSize="8"
                    fontFamily="IBM Plex Mono, ui-monospace, monospace"
                    letterSpacing="0.16em"
                    fill="currentColor"
                    textAnchor="middle"
                  >
                    {t.tag.label}
                  </text>
                </g>
              );
            })}
        </g>

        {/* THREADS — OUT (P2 → schedule): tagged threads run from
            ontology to their schedule row. Gentle S-curve to fan
            out to the 5 output rows. */}
        <g fill="none">
          {threads
            .filter((t) => t.ok)
            .slice(0, outputRows.length)
            .map((t, i) => {
              const row = outputRows[i];
              return (
                <path
                  key={`out-${i}`}
                  d={`M ${P2 + 12} ${t.midY} C 820 ${t.midY}, 830 ${row.y}, 870 ${row.y}`}
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  opacity="0.55"
                  className="text-ink"
                />
              );
            })}
        </g>

        {/* SCHEDULE GRID (RIGHT): horizontal baselines with day chip
            + event title floating at the row. */}
        <g>
          {outputRows.map((row, i) => (
            <g key={`row-${i}`}>
              <line
                x1="870"
                y1={row.y}
                x2="1170"
                y2={row.y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-ink-soft"
                opacity="0.4"
              />
              <text
                x="878"
                y={row.y - 6}
                fontSize="9"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
                letterSpacing="0.2em"
                fill="currentColor"
                className="text-ink-soft"
              >
                {row.day}
              </text>
              <text
                x="918"
                y={row.y - 6}
                fontSize="13"
                fontFamily="Fraunces, ui-serif, Georgia, serif"
                fontStyle="italic"
                fill="currentColor"
                className="text-ink"
              >
                {row.label}
              </text>
              <circle
                cx="873"
                cy={row.y}
                r="3.5"
                fill="currentColor"
                className="text-sage-deep"
              />
            </g>
          ))}
          <text
            x="873"
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
            x="1170"
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

      <div className="mt-24 pt-14 pb-10 border-t border-ink/15 flex justify-center">
        <ForgeCredit size="lg" />
      </div>
    </div>
  );
}
