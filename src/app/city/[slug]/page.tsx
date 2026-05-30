import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import type { EventWithGroup } from "@/lib/queries";
import { categorizeRegion } from "@/lib/regions";
import { EditorialLinearCard } from "@/components/variant-cards";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { toSlug, eventSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

/* Look up the canonical city string from a URL slug by scanning every
   distinct city in the events table. Cheap because the distinct city
   set is small (~20 rows). Returns null if no city matches. */
async function cityFromSlug(slug: string): Promise<string | null> {
  const rows = await db.execute<{ city: string }>(sql`
    SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND trim(city) <> ''
  `);
  const cityList = (Array.isArray(rows) ? rows : rows.rows ?? []) as Array<{ city: string }>;
  for (const r of cityList) {
    if (toSlug(r.city) === slug) return r.city;
  }
  return null;
}

async function fetchCityEvents(city: string): Promise<EventWithGroup[]> {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        gte(events.startsAt, new Date()),
        eq(events.city, city),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(200);

  return rows.map((r) => ({
    ...r.event,
    group: r.group,
    region: categorizeRegion({
      city: r.event.city,
      venueName: r.event.venueName,
      address: r.event.address,
    }),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = await cityFromSlug(slug);
  if (!city) return { title: "City not found" };
  const evts = await fetchCityEvents(city);
  const count = evts.length;
  const title = `Tech Events in ${city}, Utah`;
  const description =
    count > 0
      ? `${count} upcoming in-person tech events in ${city}, Utah — meetups, conferences, founder mixers, and developer nights. Curated from Meetup, Eventbrite, Luma, and Silicon Slopes.`
      : `Upcoming tech events in ${city}, Utah. Meetups, conferences, founder mixers, and developer nights when scheduled.`;
  return {
    title,
    description,
    alternates: { canonical: `/city/${slug}` },
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
  const city = await cityFromSlug(slug);
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
        <ul role="list" className="flex flex-col">
          {evts.map((e) => (
            <li key={e.id}>
              <EditorialLinearCard event={e} />
            </li>
          ))}
        </ul>
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
