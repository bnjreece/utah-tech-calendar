import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { EventItemListJsonLd, TagEventList } from "@/components/tag-event-list";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { toSlug } from "@/lib/slugs";
import { getTagMeta, getAllCanonicalTags, tagDisplayName, type TagMeta } from "@/lib/tag-taxonomy";
import { getSpecialWeek } from "@/lib/special-weeks";
import { hubIsIndexable, NOINDEX_FOLLOW, stripBrand } from "@/lib/seo-rules";
import { fetchTagEvents } from "@/lib/tag-events";
import { tagSlugRedirect } from "@/lib/tag-routes";

export const dynamic = "force-dynamic";

/* An old tag spelling (/tag/startup, /tag/healthtech) moves to its
   canonical page, a tag with its own page (/tag/founders) moves there,
   and a retired tag (/tag/product-management) becomes a homepage search.
   next.config.ts sends the same 308s before rendering; this covers any
   spelling that slips past it (e.g. different case). */
function redirectAlias(slug: string): void {
  const dest = tagSlugRedirect(slug);
  if (dest) permanentRedirect(dest);
}

/* Resolve a URL slug to a canonical tag. Two-pass lookup:
   1. The curated taxonomy (TAG_TAXONOMY) is the source of truth for
      "verticals we want indexed even on dry weeks" - so fintech /
      healthtech / edtech etc. render with editorial intros even
      before a single event matches.
   2. Otherwise fall back to whatever tag strings actually exist on
      approved upcoming events. */
async function tagFromSlug(slug: string): Promise<{ tag: string; meta: TagMeta | null }> {
  redirectAlias(slug);
  for (const t of getAllCanonicalTags()) {
    if (toSlug(t.tag) === slug) return { tag: t.tag, meta: t };
  }
  /* A special week's tag resolves before any row is tagged. */
  if (getSpecialWeek(slug)) return { tag: slug, meta: null };
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag: slug } = await params;
  const { tag, meta } = await tagFromSlug(slug);
  if (!tag) return { title: "Tag not found" };
  const display = meta?.display ?? tagDisplayName(tag);
  const title = stripBrand(meta?.seoTitle ?? `Utah ${display} Events`);
  /* Same in-person upcoming count the page lists; thin pages stay out of
     the index (and the sitemap, which counts the same way). */
  const evts = await fetchTagEvents(tag);
  const description =
    meta?.seoDescription ??
    `Upcoming Utah ${display} events, meetups, conferences, workshops, and developer nights. Curated from Meetup, Eventbrite, Luma, and Silicon Slopes.`;
  return {
    title,
    description,
    alternates: { canonical: `/tag/${slug}` },
    robots: hubIsIndexable(evts.length) ? undefined : NOINDEX_FOLLOW,
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
  const display = meta?.display ?? tagDisplayName(tag);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12 theme-editorial">
      <EventItemListJsonLd name={`Utah ${display} events`} events={evts} />

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
            ? `${evts.length} upcoming in-person Utah ${display} ${evts.length === 1 ? "event" : "events"}. Meetups, conferences, workshops, and developer talks tagged ${display}. Curated from ${SITE_NAME}.`
            : `Nothing on the schedule with the ${display} tag right now. Check back soon, or submit one below.`)}
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

      <TagEventList events={evts} emptyLabel={`Nothing tagged ${tag} just yet.`} />
    </div>
  );
}
