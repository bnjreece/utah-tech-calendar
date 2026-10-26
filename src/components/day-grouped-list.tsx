import type { EventWithGroup } from "@/lib/queries";
import { EditorialLinearCard } from "@/components/variant-cards";
import { groupEventsByDay } from "@/components/variant-blocks";
import { mtDate, mtYear } from "@/lib/time";

/* EditorialLinearCard rows show only a time, so any list of them needs a
   Denver day heading above each day's rows. Used by the tag, startup,
   city, group and month pages. The year shows only when it isn't the
   current one (group pages can list past years). */
export function DayGroupedEventList({ events }: { events: EventWithGroup[] }) {
  const thisYear = mtYear(new Date());
  return (
    <div className="flex flex-col">
      {groupEventsByDay(events).map((group, i) => (
        <div key={group.key}>
          <h3 className={`font-display italic text-xl sm:text-2xl text-ink mb-2 ${i === 0 ? "mt-6" : "mt-10"}`}>
            {mtDate(group.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              ...(mtYear(group.date) !== thisYear ? { year: "numeric" } : {}),
            })}
          </h3>
          <ul role="list" className="flex flex-col">
            {group.events.map((e) => (
              <li key={e.id}>
                <EditorialLinearCard event={e} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
