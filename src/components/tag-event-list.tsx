import Link from "next/link";
import type { EventWithGroup } from "@/lib/queries";
import { EditorialLinearCard } from "@/components/variant-cards";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl } from "@/lib/seo";
import { eventSlug } from "@/lib/slugs";

/* ItemList JSON-LD for a hub page's event list (links only, never Event
   markup: Google wants that on single-event pages). Null when the list is
   empty - an empty ItemList is a soft-quality signal, so a dry-week page
   is better off with no structured-data hint than "0 items". */
export function eventItemList(name: string, evts: EventWithGroup[]): Record<string, unknown> | null {
  if (evts.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: evts.slice(0, 50).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/event/${eventSlug(e.title, e.id)}`),
      name: e.title,
    })),
  };
}

export function EventItemListJsonLd({ name, events }: { name: string; events: EventWithGroup[] }) {
  const data = eventItemList(name, events);
  return data ? <JsonLd data={data} /> : null;
}

/* The schedule on a tag landing page: header with the entry count, the
   event rows, or an empty state that points to /submit. Shared by
   /tag/<tag> and /startup-events so both behave the same. */
export function TagEventList({
  events,
  emptyLabel,
  heading = "The schedule",
}: {
  events: EventWithGroup[];
  emptyLabel: string;
  heading?: string;
}) {
  return (
    <>
      <div className="mt-10 pb-3 border-b-2 border-ink flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight italic">{heading}</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft tabular-nums">
          {events.length} entries
        </span>
      </div>

      {events.length > 0 ? (
        <ul role="list" className="flex flex-col">
          {events.map((e) => (
            <li key={e.id}>
              <EditorialLinearCard event={e} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">{emptyLabel}</p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            <Link
              href="/submit"
              className="hover:text-ink transition-colors hover:underline decoration-1 underline-offset-4"
            >
              submit an event →
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
