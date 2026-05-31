import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupBySlug, getUpcomingEventsForGroup } from "@/lib/queries";
import { EditorialLinearCard } from "@/components/variant-cards";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { eventSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) return { title: "Group not found" };
  const events = await getUpcomingEventsForGroup(group.id);
  const title = `${group.name} · Utah tech meetups`;
  const description =
    events.length > 0
      ? `${events.length} upcoming ${events.length === 1 ? "event" : "events"} from ${group.name} on the Utah Tech Calendar calendar. ${group.description?.replace(/\s+/g, " ").slice(0, 140) ?? ""}`.trim()
      : `${group.name} on the Utah Tech Calendar calendar. ${group.description?.replace(/\s+/g, " ").slice(0, 200) ?? "Utah-based tech community."}`.trim();
  return {
    title,
    description,
    alternates: { canonical: `/group/${slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/group/${slug}`),
      images: group.imageUrl ? [{ url: group.imageUrl }] : undefined,
    },
  };
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  const events = await getUpcomingEventsForGroup(group.id);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: group.name,
    url: group.website ?? absoluteUrl(`/group/${slug}`),
    description: group.description ?? undefined,
    image: group.imageUrl ?? undefined,
    areaServed: { "@type": "State", name: "Utah" },
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${group.name} upcoming events`,
    itemListElement: events.slice(0, 50).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/event/${eventSlug(e.title, e.id)}`),
      name: e.title,
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12 theme-editorial">
      <JsonLd data={orgJsonLd} />
      <JsonLd data={itemList} />

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← all Utah tech events
        </Link>
      </p>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Utah tech group
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic text-ink leading-[1.05]">
        {group.name}
      </h1>

      {group.description && (
        <p className="mt-6 max-w-[62ch] text-pretty text-base sm:text-lg text-ink-soft leading-relaxed">
          {group.description}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        {group.source && <span>via {group.source}</span>}
        {group.website && (
          <>
            {group.source && <span aria-hidden>·</span>}
            <a
              href={group.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
            >
              official site ↗
            </a>
          </>
        )}
      </div>

      <div className="mt-12 pb-3 border-b-2 border-ink flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight italic">
          Upcoming
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft tabular-nums">
          {events.length} entries
        </span>
      </div>

      {events.length > 0 ? (
        <ul role="list" className="flex flex-col">
          {events.map((e) => (
            <li key={e.id}>
              <EditorialLinearCard event={e} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">
            No upcoming events from {group.name} just yet.
          </p>
          <p className="mt-3 max-w-[40ch] mx-auto text-sm text-ink-soft text-pretty">
            Check back soon — new events flow in from{" "}
            {group.source ? `${group.source}` : "the source"} every three hours.
          </p>
        </div>
      )}

      <p className="mt-16 pt-6 border-t border-ink/15 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Aggregated from {SITE_NAME} · Updated nightly
      </p>
    </div>
  );
}
