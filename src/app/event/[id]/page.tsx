import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventById } from "@/lib/queries";
import { stratumForEvent, STRATUM_CLASSES } from "@/lib/strata";
import { EventJsonLd } from "@/components/json-ld";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Community-submitted",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event not found" };

  const start = new Date(event.startsAt);
  const when = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const where = event.isOnline
    ? "online"
    : [event.venueName, event.city].filter(Boolean).join(", ") || "Utah";
  const descBase =
    event.description?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
  const description = descBase
    ? `${descBase} · ${when} · ${where}`
    : `${event.title} on ${when} in ${where}. In-person Utah tech event.`;
  const canonical = `/event/${event.id}`;

  return {
    title: event.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: absoluteUrl(canonical),
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
    },
    twitter: {
      card: event.imageUrl ? "summary_large_image" : "summary",
      title: event.title,
      description,
    },
  };
}

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
  const stratum = stratumForEvent(event.source);
  const colors = STRATUM_CLASSES[stratum];

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      <EventJsonLd event={event} />
      <Link
        href="/"
        className="text-base sm:text-sm text-ink-soft hover:text-ink transition-colors"
      >
        ← All events
      </Link>

      <div className="mt-8 overflow-hidden rounded-3xl bg-card ring-1 ring-ink/5 shadow-sm">
        <div className={`h-3 ${colors.bar}`} aria-hidden />
        <div className="px-5 pt-7 pb-9 sm:px-10 sm:pt-10 sm:pb-10">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${colors.chip}`}>
              {sourceLabel}
            </span>
            <span className="text-ink-soft">{event.region}</span>
            {event.isOnline && (
              <span className="text-dusk-deep">· Online</span>
            )}
          </div>
          <h1 className="mt-4 font-semibold text-4xl sm:text-5xl leading-[1.05] tracking-tight text-balance">
            {event.title}
          </h1>

          <dl className="mt-8 grid grid-cols-1 sm:grid-cols-[--spacing(28)_1fr] gap-y-4 gap-x-8 border-t border-ink/10 pt-6">
            <dt className="text-xs uppercase tracking-wide text-ink-soft">When</dt>
            <dd>
              <div className="font-medium text-base">
                {start.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-ink-soft tabular-nums">
                {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                {end && ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              </div>
            </dd>

            {(event.venueName || event.address || event.city) && (
              <>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Where</dt>
                <dd>
                  {event.venueName && <div className="font-medium text-base">{event.venueName}</div>}
                  {event.address && <div className="text-ink-soft">{event.address}</div>}
                  {(event.city || event.state) && (
                    <div className="text-ink-soft">
                      {[event.city, event.state, event.postalCode].filter(Boolean).join(", ")}
                    </div>
                  )}
                </dd>
              </>
            )}

            {event.group && (
              <>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Hosted by</dt>
                <dd>
                  <Link
                    href={`/group/${event.group.slug}`}
                    className="font-medium hover:text-sunset-deep transition-colors"
                  >
                    {event.group.name}
                  </Link>
                </dd>
              </>
            )}
          </dl>

          {event.description && (
            <div className="mt-8 border-t border-ink/10 pt-6">
              <p className="whitespace-pre-wrap text-pretty text-base leading-7 text-ink/85 max-w-[68ch]">
                {event.description}
              </p>
            </div>
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5" role="list">
              {event.tags.map((t) => (
                <span
                  key={t}
                  role="listitem"
                  className="inline-flex items-center rounded-full bg-paper-deep px-3 py-1 text-xs text-ink-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {event.link && (
            <div className="mt-8 pt-6 border-t border-ink/10">
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-base sm:px-5 sm:py-2.5 sm:text-sm font-medium text-paper hover:bg-ink/85 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
              >
                RSVP and details
                <span aria-hidden>↗</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
