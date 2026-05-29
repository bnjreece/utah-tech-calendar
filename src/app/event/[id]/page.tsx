import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getEventById } from "@/lib/queries";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← All events
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mt-4">
        {event.title}
      </h1>

      <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-muted-foreground">
        <Badge variant="secondary">{event.region}</Badge>
        <Badge variant="outline">{event.source}</Badge>
        {event.isOnline && <Badge variant="outline">Online</Badge>}
        {event.group && (
          <span>
            ·{" "}
            <Link href={`/group/${event.group.slug}`} className="hover:text-foreground underline">
              {event.group.name}
            </Link>
          </span>
        )}
      </div>

      <Card className="mt-6 p-6 flex flex-col gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">When</div>
          <div className="text-base mt-1">
            {start.toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {end && (
              <span className="text-muted-foreground">
                {" – "}
                {end.toLocaleString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {(event.venueName || event.address || event.city) && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Where</div>
            <div className="text-base mt-1">
              {event.venueName && <div>{event.venueName}</div>}
              {event.address && <div className="text-muted-foreground">{event.address}</div>}
              {(event.city || event.state) && (
                <div className="text-muted-foreground">
                  {[event.city, event.state, event.postalCode].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        {event.description && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">About</div>
            <p className="text-base mt-1 whitespace-pre-wrap leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        )}

        {event.link && (
          <div className="pt-2">
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default" })}
            >
              RSVP / More info ↗
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
