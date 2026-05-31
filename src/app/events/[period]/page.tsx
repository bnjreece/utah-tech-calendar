import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, events, groups } from "@/lib/db";
import type { EventWithGroup } from "@/lib/queries";
import { categorizeRegion } from "@/lib/regions";
import { EditorialLinearCard } from "@/components/variant-cards";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { eventSlug } from "@/lib/slugs";
import { parsePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

async function fetchPeriodEvents(from: Date, to: Date): Promise<EventWithGroup[]> {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        gte(events.startsAt, from),
        lt(events.startsAt, to),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(500);

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
  params: Promise<{ period: string }>;
}): Promise<Metadata> {
  const { period: slug } = await params;
  const parsed = parsePeriod(slug);
  if (!parsed) return { title: "Period not found" };
  const evts = await fetchPeriodEvents(parsed.from, parsed.to);
  const title = `Utah Tech Calendar · ${parsed.display}`;
  const description =
    evts.length > 0
      ? `${evts.length} Utah tech events in ${parsed.display} — meetups, conferences, founder mixers, and developer nights across Salt Lake City, Provo, Lehi, Ogden, and Silicon Slopes.`
      : `Upcoming Utah tech events for ${parsed.display}. Meetups, conferences, and workshops when scheduled.`;
  return {
    title,
    description,
    alternates: { canonical: `/events/${slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/events/${slug}`),
    },
  };
}

export default async function PeriodPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period: slug } = await params;
  const parsed = parsePeriod(slug);
  if (!parsed) notFound();
  const evts = await fetchPeriodEvents(parsed.from, parsed.to);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Utah tech events · ${parsed.display}`,
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

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Archive
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic text-ink">
        Utah tech events · {parsed.display}
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-base sm:text-lg text-ink-soft leading-relaxed">
        {evts.length > 0
          ? `${evts.length} Utah tech ${evts.length === 1 ? "event" : "events"} scheduled for ${parsed.display}. Meetups, conferences, founder mixers, AI nights, and developer talks across the Wasatch Front. Curated from ${SITE_NAME}.`
          : `Nothing scheduled for ${parsed.display} yet. Check back as the date approaches.`}
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
            No events scheduled for {parsed.display} yet.
          </p>
        </div>
      )}
    </div>
  );
}
