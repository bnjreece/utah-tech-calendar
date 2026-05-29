import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← All events
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mt-4">{group.name}</h1>
      {group.description && (
        <p className="text-base text-muted-foreground mt-2">{group.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
        {group.source && <Badge variant="outline">{group.source}</Badge>}
        {group.website && (
          <a href={group.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground underline">
            Website ↗
          </a>
        )}
        {group.defaultTags && group.defaultTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {group.defaultTags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-3">
        Upcoming events ({events.length})
      </h2>
      <EventList events={events} />
    </div>
  );
}
