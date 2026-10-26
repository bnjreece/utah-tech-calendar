import type { Metadata } from "next";
import Link from "next/link";
import { EventItemListJsonLd, TagEventList } from "@/components/tag-event-list";
import { absoluteUrl } from "@/lib/seo";
import { DEFAULT_OG_IMAGES, hubIsIndexable, NOINDEX_FOLLOW } from "@/lib/seo-rules";
import { STARTUP_SCENE } from "@/lib/startup-scene";
import { fetchTagEvents } from "@/lib/tag-events";
import { STARTUP_EVENTS_PATH } from "@/lib/tag-routes";
import { countThisWeek, mtDate } from "@/lib/time";

/* The founders tag's landing page (/tag/founders, /tag/startup and
   /tag/founder 308 here; lib/tag-routes.ts). Same list and query as a
   /tag page, plus the regular meetups and annual events that make up the
   scene (lib/startup-scene.ts). Rendered per request like /tag pages. */
export const dynamic = "force-dynamic";

const TAG = "founders";
const TITLE = "Utah Startup Events & Meetups";
const DESCRIPTION =
  "Upcoming Utah startup events: pitch nights, founder meetups and demo days across Salt Lake, Lehi, Provo and Ogden, updated daily.";

export async function generateMetadata(): Promise<Metadata> {
  /* Same in-person upcoming count the page lists and the sitemap uses. */
  const evts = await fetchTagEvents(TAG);
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: STARTUP_EVENTS_PATH },
    robots: hubIsIndexable(evts.length) ? undefined : NOINDEX_FOLLOW,
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl(STARTUP_EVENTS_PATH),
      images: DEFAULT_OG_IMAGES,
    },
  };
}

const longDate = (d: Date | string) => mtDate(d, { month: "short", day: "numeric", year: "numeric" });

/* "2026-10-26" as a Denver calendar date, without a UTC midnight shift. */
const dayKeyDate = (key: string) => longDate(new Date(`${key}T12:00:00-06:00`));

const EXTERNAL = "text-ink underline decoration-1 underline-offset-4 hover:text-sunset-deep transition-colors";

export default async function StartupEventsPage() {
  const evts = await fetchTagEvents(TAG);
  const now = new Date();
  const thisWeek = countThisWeek(evts.map((e) => e.startsAt), now);
  /* The newest change to a listed event; the page renders per request, so
     with nothing listed the data is as fresh as this render. */
  const latest = evts.reduce<Date | null>((max, e) => {
    const u = e.updatedAt ? new Date(e.updatedAt) : null;
    return u && (!max || u > max) ? u : max;
  }, null);
  const updated = longDate(latest ?? now);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12 theme-editorial">
      <EventItemListJsonLd name="Utah startup events" events={evts} />

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← all Utah tech events
        </Link>
      </p>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Founders &amp; startups
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic text-ink">
        Utah startup events
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-base sm:text-lg text-ink-soft leading-relaxed">
        Upcoming in-person startup events in Utah: pitch nights, founder meetups, investor talks and
        demo days. The list is pulled from Meetup, Luma, Eventbrite, Silicon Slopes and organizer
        sites. Below it are the regular meetups and the big events on the Utah startup calendar.
      </p>
      <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft tabular-nums">
        {thisWeek > 0 && (
          <span className="text-sunset-deep">
            {thisWeek} this week
          </span>
        )}
        <span>Updated {updated}</span>
      </p>

      <TagEventList events={evts} emptyLabel="No startup events on the schedule just yet." />

      <section aria-labelledby="regular-meetups" className="mt-16">
        <div className="pb-3 border-b-2 border-ink">
          <h2 id="regular-meetups" className="font-display text-2xl sm:text-3xl tracking-tight italic">
            Regular startup meetups in Utah
          </h2>
        </div>
        <ul role="list" className="flex flex-col">
          {STARTUP_SCENE.recurring.map((m) => (
            <li key={m.name} className="py-5 border-t border-ink/10 first:border-t-0">
              <h3 className="font-display text-lg sm:text-xl leading-snug text-ink text-pretty">
                <a href={m.url} target="_blank" rel="noopener" className={EXTERNAL}>
                  {m.name}
                </a>
              </h3>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {m.cadence}
              </p>
              <p className="mt-1 text-sm text-ink-soft text-pretty break-words">{m.where}</p>
              <p className="mt-2 max-w-[68ch] text-base text-ink text-pretty leading-relaxed">{m.blurb}</p>
              {m.groupSlug && (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em]">
                  <Link href={`/group/${m.groupSlug}`} className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4">
                    upcoming dates →
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="annual-events" className="mt-16">
        <div className="pb-3 border-b-2 border-ink">
          <h2 id="annual-events" className="font-display text-2xl sm:text-3xl tracking-tight italic">
            Big startup events through the year
          </h2>
        </div>
        <ul role="list" className="flex flex-col">
          {STARTUP_SCENE.annual.map((a) => (
            <li key={a.name} className="py-5 border-t border-ink/10 first:border-t-0">
              <h3 className="font-display text-lg sm:text-xl leading-snug text-ink text-pretty">
                <a href={a.url} target="_blank" rel="noopener" className={EXTERNAL}>
                  {a.name}
                </a>
              </h3>
              <p className="mt-1 text-sm text-ink-soft text-pretty">{a.when}</p>
              <p className="mt-1 text-sm text-ink-soft text-pretty break-words">{a.where}</p>
              <p className="mt-2 max-w-[68ch] text-base text-ink text-pretty leading-relaxed">{a.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Meetups and major events checked {dayKeyDate(STARTUP_SCENE.lastVerified)} ·{" "}
        <Link href="/submit" className="hover:text-ink hover:underline decoration-1 underline-offset-4">
          submit an event
        </Link>
      </p>
    </div>
  );
}
