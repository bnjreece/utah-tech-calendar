import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventById } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Community-submitted",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-foreground/55 hover:text-foreground transition-colors"
      >
        ← All events
      </Link>

      <p className="mt-8 text-sm uppercase tracking-wide text-brand-deep font-medium">
        {event.region}
        {event.isOnline ? " · Online" : ""}
      </p>
      <h1 className="mt-2 font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-balance">
        {event.title}
      </h1>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-[--spacing(36)_1fr] gap-y-5 gap-x-8 border-t border-foreground/10 pt-8">
        <dt className="text-xs uppercase tracking-wide text-foreground/45">When</dt>
        <dd className="text-base">
          <div className="font-medium">
            {start.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="text-foreground/65 tabular-nums">
            {start.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
            {end &&
              ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
          </div>
        </dd>

        {(event.venueName || event.address || event.city) && (
          <>
            <dt className="text-xs uppercase tracking-wide text-foreground/45">Where</dt>
            <dd className="text-base">
              {event.venueName && <div className="font-medium">{event.venueName}</div>}
              {event.address && <div className="text-foreground/65">{event.address}</div>}
              {(event.city || event.state) && (
                <div className="text-foreground/65">
                  {[event.city, event.state, event.postalCode].filter(Boolean).join(", ")}
                </div>
              )}
            </dd>
          </>
        )}

        {event.group && (
          <>
            <dt className="text-xs uppercase tracking-wide text-foreground/45">Hosted by</dt>
            <dd className="text-base">
              <Link
                href={`/group/${event.group.slug}`}
                className="hover:text-brand transition-colors"
              >
                {event.group.name}
              </Link>
            </dd>
          </>
        )}

        <dt className="text-xs uppercase tracking-wide text-foreground/45">Source</dt>
        <dd className="text-base text-foreground/65">{sourceLabel}</dd>
      </div>

      {event.description && (
        <div className="mt-10">
          <p className="whitespace-pre-wrap text-pretty text-base leading-7 text-foreground/80 max-w-[68ch]">
            {event.description}
          </p>
        </div>
      )}

      {event.tags && event.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-1.5" role="list">
          {event.tags.map((t) => (
            <span
              key={t}
              role="listitem"
              className="inline-flex items-center rounded-full bg-foreground/[0.05] px-3 py-1 text-xs text-foreground/70"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {event.link && (
        <div className="mt-10 pt-8 border-t border-foreground/10">
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            RSVP and details
            <span aria-hidden>↗</span>
          </a>
        </div>
      )}
    </article>
  );
}
