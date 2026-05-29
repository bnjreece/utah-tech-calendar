import { EventCard } from "./event-card";
import type { EventWithGroup } from "@/lib/queries";

function isoDay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function EventList({ events, grouped = false }: { events: EventWithGroup[]; grouped?: boolean }) {
  if (!events.length) {
    return (
      <div className="text-center text-muted-foreground py-16 text-sm">
        No events match these filters. Try widening your date range or clearing filters.
      </div>
    );
  }

  if (!grouped) {
    return (
      <div className="flex flex-col gap-2">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    );
  }

  const buckets = new Map<string, EventWithGroup[]>();
  for (const e of events) {
    const key = isoDay(new Date(e.startsAt));
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(buckets.entries()).map(([day, items]) => (
        <section key={day}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {day}
          </h2>
          <div className="flex flex-col gap-2">
            {items.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
