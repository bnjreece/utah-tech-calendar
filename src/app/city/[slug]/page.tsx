import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findCityBySlug, getUpcomingCityEvents } from "@/lib/queries";
import { DayGroupedEventList } from "@/components/day-grouped-list";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { eventSlug } from "@/lib/slugs";
import { hubIsIndexable, NOINDEX_FOLLOW } from "@/lib/seo-rules";

/* On-demand ISR (empty generateStaticParams, generate-static-params.md):
   each city is a cached page built on first visit from the shared cached
   dataset, so no database query. 15 minutes drops started events; the
   public-data tag marks it stale after each scrape. */
export const revalidate = 900;

export async function generateStaticParams() {
  return [];
}

/* Upcoming in-person events in the city, capped for the page. */
async function fetchCityEvents(city: string) {
  return (await getUpcomingCityEvents(city)).slice(0, 200);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = await findCityBySlug(slug);
  if (!city) return { title: "City not found" };
  const evts = await fetchCityEvents(city);
  const count = evts.length;
  const title = `Tech Events in ${city}, Utah`;
  const description =
    count > 0
      ? `${count} upcoming in-person tech events in ${city}, Utah: meetups, conferences, founder mixers, and developer nights. Curated from Meetup, Eventbrite, Luma, and Silicon Slopes.`
      : `Upcoming tech events in ${city}, Utah. Meetups, conferences, founder mixers, and developer nights when scheduled.`;
  return {
    title,
    description,
    alternates: { canonical: `/city/${slug}` },
    robots: hubIsIndexable(count) ? undefined : NOINDEX_FOLLOW,
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/city/${slug}`),
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await findCityBySlug(slug);
  if (!city) notFound();

  const evts = await fetchCityEvents(city);

  /* ItemList JSON-LD pointing at the canonical event URLs gives Google
     a structured view of the page's content. */
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Tech events in ${city}, Utah`,
    itemListElement: evts.slice(0, 50).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/event/${eventSlug(e.title, e.id)}`),
      name: e.title,
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12 theme-editorial">
      <JsonLd data={itemList} />

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← all Utah tech events
        </Link>
      </p>

      <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight italic text-ink">
        Tech events in {city}
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-base sm:text-lg text-ink-soft leading-relaxed">
        {evts.length > 0
          ? `${evts.length} upcoming in-person tech ${evts.length === 1 ? "event" : "events"} in ${city}, Utah. Meetups, conferences, founder mixers, AI nights, hardware hacks, and developer talks. Curated from ${SITE_NAME}.`
          : `No upcoming in-person tech events listed in ${city} yet. Check back soon, or submit one below.`}
      </p>

      <div className="mt-10 pb-3 border-b-2 border-ink flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight italic">
          The schedule
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft tabular-nums">
          {evts.length} entries
        </span>
      </div>

      {evts.length > 0 ? (
        <DayGroupedEventList events={evts} />
      ) : (
        <div className="py-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">
            Nothing on the schedule for {city} yet.
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            <Link href="/submit" className="hover:text-ink transition-colors hover:underline decoration-1 underline-offset-4">
              submit an event →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
