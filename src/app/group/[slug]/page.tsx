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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-ink-soft hover:text-ink transition-colors"
      >
        ← All events
      </Link>

      <div className="mt-8 rounded-3xl overflow-hidden bg-card ring-1 ring-ink/5 shadow-sm">
        <div aria-hidden className="h-3 strata-divider" />
        <div className="p-8 sm:p-10">
          <p className="text-sm uppercase tracking-[0.18em] text-ink-soft font-medium">
            Group
          </p>
          <h1 className="mt-3 font-semibold text-4xl sm:text-5xl leading-[1.05] tracking-tight text-balance">
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-4 text-base text-ink-soft text-pretty max-w-[62ch]">
              {group.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            {group.source && <span>{group.source}</span>}
            {group.website && (
              <>
                <span aria-hidden>·</span>
                <a
                  href={group.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors"
                >
                  Website ↗
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="mt-10 font-semibold text-2xl tracking-tight">
        {events.length} upcoming
      </h2>
      <div className="mt-5">
        <EventList events={events} />
      </div>
    </div>
  );
}
