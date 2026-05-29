import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EventWithGroup } from "@/lib/queries";

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  manual: "Submitted",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
};

function formatDateTime(date: Date): { day: string; time: string } {
  const day = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { day, time };
}

export function EventCard({ event }: { event: EventWithGroup }) {
  const start = new Date(event.startsAt);
  const { day, time } = formatDateTime(start);
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;

  return (
    <Card className="p-4 hover:bg-accent/30 transition-colors">
      <Link href={`/event/${event.id}`} className="block">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center justify-center min-w-16 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {day.split(", ")[0]}
            </div>
            <div className="text-xl font-semibold leading-tight">
              {start.getDate()}
            </div>
            <div className="text-xs text-muted-foreground">
              {start.toLocaleDateString("en-US", { month: "short" })}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-snug truncate">
                {event.title}
              </h3>
              <Badge variant="secondary" className="text-xs shrink-0">
                {sourceLabel}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-2">
              <span>{time}</span>
              {event.venueName && (
                <>
                  <span>·</span>
                  <span className="truncate">{event.venueName}</span>
                </>
              )}
              {event.city && (
                <>
                  <span>·</span>
                  <span>{event.city}</span>
                </>
              )}
              {event.isOnline && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="text-xs">Online</Badge>
                </>
              )}
            </div>
            {event.group && (
              <div className="mt-1 text-xs text-muted-foreground">
                {event.group.name}
              </div>
            )}
            {event.tags && event.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {event.tags.slice(0, 5).map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
