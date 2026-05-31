import { EventCard } from "./event-card";
import type { EventWithGroup } from "@/lib/queries";
import { mtDate } from "@/lib/time";

function dayLabel(d: Date): string {
  return mtDate(d, {
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
      <div className="rounded-3xl bg-card ring-1 ring-ink/5 py-24 text-center">
        <p className="font-semibold text-2xl">No events match.</p>
        <p className="mt-2 text-sm text-ink-soft">
          Widen your date range or drop a filter.
        </p>
      </div>
    );
  }

  if (!grouped) {
    return (
      <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="flex items-baseline gap-3 mb-4">
            <span aria-hidden className="h-2 flex-1 rounded-full strata-divider opacity-30" />
            <h2 className="font-semibold text-lg tracking-tight">
              {day}
            </h2>
            <span aria-hidden className="h-2 flex-1 rounded-full strata-divider opacity-30" />
          </div>
          <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
