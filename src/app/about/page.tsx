import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `About ${SITE_NAME}. Why this calendar exists, how events get on the schedule, and how you can contribute.`,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    title: `About · ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/about"),
  },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 theme-editorial">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        About
      </p>

      <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight italic text-ink leading-[1.1]">
        A periodical of Utah tech events.
      </h1>

      <div className="mt-10 prose-editorial space-y-6 text-pretty text-ink leading-relaxed">
        <p className="text-lg sm:text-xl">
          <strong>{SITE_NAME}</strong> is the comprehensive calendar of in-person tech
          gatherings across Utah. Meetups, conferences, founder mixers, AI
          builder nights, hardware hacks, developer talks, design critiques,
          startup pitch nights — anything where Utah&apos;s tech community shows
          up in a room together.
        </p>

        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight mt-12">
          Why this exists
        </h2>
        <p>
          Utah&apos;s tech scene is unusually concentrated. The Wasatch
          Front carries the SLC node (downtown, University of Utah / Lassonde
          Studios, Sugar House) and the Lehi–Provo corridor (Silicon Slopes,
          BYU, UVU, Kiln Lehi). There are smaller pockets in Ogden and Park
          City. The events are out there — they&apos;re just scattered across
          Meetup, Eventbrite, Luma, Silicon Slopes, Substack newsletters, and
          a half-dozen Slack channels.
        </p>
        <p>
          This calendar pulls them into one place, filters out the SEO-spam
          training courses, hides online-only events by default, and surfaces
          conferences and paid-ticket events with badges so you can scan a
          month in a glance.
        </p>

        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight mt-12">
          How events get on the schedule
        </h2>
        <p>
          Three paths in. <strong>Scrapers</strong> run every three hours
          against Meetup groups (UtahJS, Utah Rust, Utah Software Craftsmanship,
          Salt Lake AWS, Utah Python, and others), Luma calendars, Eventbrite
          city searches, and the Silicon Slopes community. Newsletter-only
          series (Utah Burger Club) pull from their Substack RSS. Headline
          conferences are flagged by hand from organizer announcements.
        </p>
        <p>
          The second path is community: anyone can{" "}
          <Link
            href="/submit"
            className="text-sunset-deep hover:underline decoration-1 underline-offset-4"
          >
            submit an event
          </Link>
          {" "}via a form. Submissions get a quick human review.
        </p>
        <p>
          The third is light editorial work — duplicate templated events get
          collapsed by an automated sweep, and obvious off-topic events
          (cooking classes, cosmetics workshops) get hidden when they appear.
        </p>

        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight mt-12">
          Coverage areas
        </h2>
        <p>
          <Link href="/city/salt-lake-city" className="hover:text-sunset-deep hover:underline decoration-1 underline-offset-4">Salt Lake City</Link>,
          {" "}
          <Link href="/city/provo" className="hover:text-sunset-deep hover:underline decoration-1 underline-offset-4">Provo</Link>,
          {" "}
          <Link href="/city/lehi" className="hover:text-sunset-deep hover:underline decoration-1 underline-offset-4">Lehi</Link>,
          {" "}
          <Link href="/city/sandy" className="hover:text-sunset-deep hover:underline decoration-1 underline-offset-4">Sandy</Link>,
          {" "}Ogden, Park City, and the rest of the Wasatch Front. Regional rollups by Salt Lake County, Utah County, Northern Utah, and Southern Utah are available via the filter bar.
        </p>

        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight mt-12">
          Subscribe
        </h2>
        <p>
          The schedule is available as an iCal feed, RSS, or curated calendar
          presets at{" "}
          <Link
            href="/subscribe"
            className="text-sunset-deep hover:underline decoration-1 underline-offset-4"
          >
            /subscribe
          </Link>
          . Every filter combination on the schedule page is itself a valid
          subscription URL.
        </p>

        <p className="mt-12 pt-6 border-t border-ink/15 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          Compiled in Cottonwood Heights, Utah · Updated nightly
        </p>
      </div>
    </article>
  );
}
