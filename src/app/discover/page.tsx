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

const VERTICALS = getFeaturedVerticals();

export default function DiscoverPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 theme-editorial">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Discover Utah Tech
      </p>

      <h1 className="mt-4 font-display text-4xl sm:text-6xl tracking-tight italic text-ink leading-[1.05]">
        You don&apos;t know what you don&apos;t know.
      </h1>

      <p className="mt-8 text-lg sm:text-xl text-ink leading-relaxed text-pretty">
        That&apos;s the whole problem with the Utah tech scene. An enormous
        amount is happening every week, across half a dozen verticals
        and a dozen cities, and most of it only reaches you if someone
        in your group chat happens to mention it. Word-of-mouth is a
        slow signal in a fast community.
      </p>

      <p className="mt-5 text-base sm:text-lg text-ink-soft leading-relaxed text-pretty">
        Discoverability is the first step to connection. {SITE_NAME} is
        the map: one page, every in-person Utah tech event we can find,
        run as a free public service. No login, no profile, no tracking.
        Just a place to see what&apos;s on this week.
      </p>

      {/* The promise */}
      <section className="mt-16 border-t-2 border-ink pt-8">
        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight">
          What you get.
        </h2>
        <ul className="mt-6 flex flex-col gap-5 text-base text-ink leading-relaxed">
          <Feature
            eyebrow="The schedule"
            title="Every in-person tech event in Utah, in one feed."
            body="We watch the calendars you&apos;d have to check by hand: Meetup groups, Luma calendars, Silicon Slopes, Eventbrite organizer pages, industry-group sites. New events show up here as soon as they&apos;re posted there."
          />
          <Feature
            eyebrow="Verticals"
            title="Eight curated content tags, hand-tuned for Utah."
            body={
              <>
                AI, fintech, biotech, healthtech, aerospace, cybersecurity,
                game dev, and the founder/startup track. Each one has its
                own page with the anchor employers, the regular meetups,
                and the events on the schedule right now.{" "}
                <Link
                  href="/tag/biotech"
                  className="underline decoration-1 underline-offset-4 hover:text-sunset-deep"
                >
                  Try biotech.
                </Link>
              </>
            }
          />
          <Feature
            eyebrow="Cities"
            title="Slice by region and city, not just by topic."
            body="Filter to Salt Lake County, Provo, Lehi, Ogden, or any neighborhood that&apos;s populated enough to have its own scene. In-person only, online events hidden by default."
          />
          <Feature
            eyebrow="Pipelines"
            title="Four ways to stay on it."
            body={
              <>
                Subscribe to the iCal feed and it lives in your Apple or
                Google Calendar. Get the Monday morning email digest with
                just the events on your filter. Pull the RSS feed into
                whatever reader you use. Or build a filtered view and
                share the link with someone who&apos;d care.{" "}
                <Link
                  href="/subscribe"
                  className="underline decoration-1 underline-offset-4 hover:text-sunset-deep"
                >
                  Set one up.
                </Link>
              </>
            }
          />
          <Feature
            eyebrow="Quality"
            title="Aggressive curation, transparent rules."
            body="Eventbrite cert-spam (the &ldquo;PMP 4 Days Training&rdquo; sprawl), make-and-take craft workshops cross-posted to every tech meetup, and stale 2030-dated placeholder events all get filtered out before they reach the public schedule. If something slips through, the source-attribution is on every card so you know where it came from."
          />
          <Feature
            eyebrow="Submissions"
            title="Anyone can submit an event we&apos;re missing."
            body={
              <>
                If you know about a meetup, conference, or recurring event
                that isn&apos;t here, send it our way. We&apos;d rather have it on
                the calendar than not.{" "}
                <Link
                  href="/submit"
                  className="underline decoration-1 underline-offset-4 hover:text-sunset-deep"
                >
                  Submit one.
                </Link>{" "}
                Same goes for whole sources, if you&apos;re an organizer running a
                calendar we could pull from.
              </>
            }
          />
        </ul>
      </section>

      {/* Verticals quick-jump */}
      <section className="mt-16 border-t-2 border-ink pt-8">
        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight">
          Drop into a vertical.
        </h2>
        <p className="mt-3 text-base text-ink-soft text-pretty leading-relaxed">
          Each page reads like a quick orientation: who the anchor
          employers are, what&apos;s on the schedule, where the community
          meets.
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VERTICALS.map((v) => (
            <Link
              key={v.tag}
              href={`/tag/${v.tag}`}
              className="group flex flex-col gap-1.5 rounded-2xl border border-ink/15 bg-paper p-4 transition-colors hover:border-ink/40"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft group-hover:text-sunset-deep transition-colors">
                {v.tag}
              </span>
              <span className="font-display text-lg italic tracking-tight text-ink">
                {v.display}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* What we do not do */}
      <section className="mt-16 border-t-2 border-ink pt-8">
        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight">
          What we don&apos;t do.
        </h2>
        <ul className="mt-6 flex flex-col gap-4 text-base text-ink leading-relaxed">
          <li className="flex gap-3">
            <span aria-hidden className="font-mono text-ink-soft mt-1">·</span>
            <span>
              <strong>No accounts.</strong> There&apos;s nothing to sign up for.
              No profile, no password, no &ldquo;continue with Google.&rdquo;
              The email digest is the one optional channel and you can
              unsubscribe with a link.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="font-mono text-ink-soft mt-1">·</span>
            <span>
              <strong>No tracking.</strong> No third-party advertising scripts,
              no cross-site pixel, no behavioral profile. Vercel ships a
              minimal privacy-respecting analytics counter so we can see
              the calendar is being used; that&apos;s the entire data trail.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="font-mono text-ink-soft mt-1">·</span>
            <span>
              <strong>No cookie banner.</strong> Because there are no
              tracking cookies to consent to.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="font-mono text-ink-soft mt-1">·</span>
            <span>
              <strong>No paywall, no donations page, no upsell.</strong> The
              calendar is free, run as a service to the Utah tech community,
              and intended to stay that way.
            </span>
          </li>
        </ul>
      </section>

      {/* The principle */}
      <section className="mt-16 border-t-2 border-ink pt-8">
        <h2 className="font-display text-2xl sm:text-3xl italic tracking-tight">
          The principle.
        </h2>
        <p className="mt-6 text-base sm:text-lg text-ink leading-relaxed text-pretty">
          Word-of-mouth is a beautiful signal at the table you happen to
          be sitting at. It is a terrible signal across a community of
          thousands. The right way to make a scene visible is to make a
          map of it - public, neutral, free to use, easy to share.
        </p>
        <p className="mt-4 text-base text-ink leading-relaxed text-pretty">
          That&apos;s what this is.
        </p>
      </section>

      <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← back to the schedule
        </Link>
      </p>
    </article>
  );
}

function Feature({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-ink/15 pt-5 first:border-t-0 first:pt-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sunset-deep">
        {eyebrow}
      </span>
      <h3 className="font-display text-lg sm:text-xl italic tracking-tight text-ink">
        {title}
      </h3>
      <p className="text-base text-ink-soft leading-relaxed text-pretty">
        {body}
      </p>
    </li>
  );
}
