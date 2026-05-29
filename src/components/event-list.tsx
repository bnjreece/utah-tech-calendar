import { EventCard } from "./event-card";
import type { EventWithGroup } from "@/lib/queries";

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function EventList({
  events,
  grouped = false,
}: {
  events: EventWithGroup[];
  grouped?: boolean;
}) {
  if (!events.length) {
    return (
      <div className="border-t border-foreground/10 py-24 text-center">
        <p className="font-display text-2xl text-foreground/40">No events here.</p>
        <p className="mt-2 text-sm text-foreground/55">
          Try a wider date range or clearing some filters.
        </p>
      </div>
    );
  }

  if (!grouped) {
    return (
      <ul role="list" className="divide-y divide-foreground/10 border-t border-foreground/10">
        {events.map((e) => (
          <li key={e.id}>
            <EventCard event={e} />
          </li>
        ))}
      </ul>
    );
  }

  const buckets = new Map<string, EventWithGroup[]>();
  for (const e of events) {
    const key = dayLabel(new Date(e.startsAt));
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-10">
      {Array.from(buckets.entries()).map(([day, items]) => (
        <section key={day}>
          <h2 className="font-display text-3xl text-foreground/85 tracking-tight">
            {day}
          </h2>
          <ul role="list" className="mt-2 divide-y divide-foreground/10 border-t border-foreground/10">
            {items.map((e) => (
              <li key={e.id}>
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
