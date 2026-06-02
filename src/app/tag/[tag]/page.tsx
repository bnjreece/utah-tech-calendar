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
import { getTagMeta, getAllCanonicalTags, type TagMeta } from "@/lib/tag-taxonomy";

export const dynamic = "force-dynamic";

/* Resolve a URL slug to a canonical tag. Two-pass lookup:
   1. The curated taxonomy (TAG_TAXONOMY) is the source of truth for
      "verticals we want indexed even on dry weeks" - so fintech /
      healthtech / edtech etc. render with editorial intros even
      before a single event matches.
   2. Otherwise fall back to whatever tag strings actually exist on
      approved upcoming events. */
async function tagFromSlug(slug: string): Promise<{ tag: string; meta: TagMeta | null }> {
  for (const t of getAllCanonicalTags()) {
    if (toSlug(t.tag) === slug) return { tag: t.tag, meta: t };
  }
  const rows = await db.execute<{ tag: string }>(sql`
    SELECT DISTINCT lower(tag) AS tag
    FROM events, unnest(tags) AS tag
    WHERE status = 'approved' AND starts_at >= now()
  `);
  const tagList = (Array.isArray(rows) ? rows : rows.rows ?? []) as Array<{ tag: string }>;
  for (const r of tagList) {
    if (toSlug(r.tag) === slug) return { tag: r.tag, meta: getTagMeta(r.tag) };
  }
  return { tag: "", meta: null };
}

async function fetchTagEvents(tag: string): Promise<EventWithGroup[]> {
  const rows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        gte(events.startsAt, new Date()),
        sql`lower(${tag}) = ANY(SELECT lower(t) FROM unnest(${events.tags}) AS t)`,
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

function tagTitle(tag: string): string {
  return tag
    .split(/[\s-]+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag: slug } = await params;
  const { tag, meta } = await tagFromSlug(slug);
  if (!tag) return { title: "Tag not found" };
  const display = meta?.display ?? tagTitle(tag);
  const title = meta?.seoTitle ?? `Utah ${display} Events`;
  const description =
    meta?.seoDescription ??
    `Upcoming Utah ${display} events, meetups, conferences, workshops, and developer nights. Curated from Meetup, Eventbrite, Luma, and Silicon Slopes.`;
  return {
    title,
    description,
    alternates: { canonical: `/tag/${slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/tag/${slug}`),
    },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: slug } = await params;
  const { tag, meta } = await tagFromSlug(slug);
  if (!tag) notFound();
  const evts = await fetchTagEvents(tag);
  const display = meta?.display ?? tagTitle(tag);

  /* Only emit ItemList JSON-LD when we have content - Google treats an
     empty ItemList as a soft-quality signal, so a dry-week vertical
     page is better off with no structured-data hint than a misleading
     one claiming "0 items in this list". */
  const itemList = evts.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Utah ${display} events`,
    itemListElement: evts.slice(0, 50).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/event/${eventSlug(e.title, e.id)}`),
      name: e.title,
    })),
  } : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12 theme-editorial">
      {itemList && <JsonLd data={itemList} />}

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← all Utah tech events
        </Link>
      </p>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Vertical
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic text-ink">
        Utah {display} events
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-base sm:text-lg text-ink-soft leading-relaxed">
        {meta?.intro ??
          (evts.length > 0
            ? `${evts.length} upcoming in-person Utah ${display} ${evts.length === 1 ? "event" : "events"}. Meetups, conferences, workshops, and developer talks tagged ${tag}. Curated from ${SITE_NAME}.`
            : `Nothing on the schedule with the ${tag} tag right now. Check back soon, or submit one below.`)}
      </p>
      {(() => {
        const anchors = meta?.anchors;
        if (!anchors || anchors.length === 0) return null;
        return (
          <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 max-w-[68ch]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Anchor employers
            </span>
            {anchors.map((a, i) => (
              <span key={a} className="text-sm text-ink">
                {a}
                {i < anchors.length - 1 && (
                  <span aria-hidden className="text-ink-soft"> · </span>
                )}
              </span>
            ))}
          </div>
        );
      })()}

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
            Nothing tagged {tag} just yet.
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
