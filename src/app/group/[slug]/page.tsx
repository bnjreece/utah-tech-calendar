import Link from "next/link";
import { notFound } from "next/navigation";
import { EventList } from "@/components/event-list";
import { getGroupBySlug, getUpcomingEventsForGroup } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  const events = await getUpcomingEventsForGroup(group.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-foreground/55 hover:text-foreground transition-colors"
      >
        ← All events
      </Link>

      <p className="mt-8 text-sm uppercase tracking-wide text-brand-deep font-medium">
        Group
      </p>
      <h1 className="mt-2 font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-balance">
        {group.name}
      </h1>
      {group.description && (
        <p className="mt-4 text-base text-foreground/65 text-pretty max-w-[62ch]">
          {group.description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/55">
        {group.source && <span>{group.source}</span>}
        {group.website && (
          <>
            <span aria-hidden>·</span>
            <a
              href={group.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Website ↗
            </a>
          </>
        )}
      </div>

      <h2 className="mt-12 font-display text-3xl tracking-tight">
        {events.length} upcoming
      </h2>
      <div className="mt-4">
        <EventList events={events} />
      </div>
    </div>
  );
}
