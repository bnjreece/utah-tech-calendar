import type { Adapter, EventItem } from "./types";
import { meetupAdapter } from "./adapters/meetup";
import { lumaAdapter } from "./adapters/luma";
import { eventbriteAdapter } from "./adapters/eventbrite";
import { siliconSlopesAdapter } from "./adapters/silicon-slopes";
import { substackAdapter } from "./adapters/substack";
import { utahGeekEventsAdapter } from "./adapters/utah-geek-events";
import { recurrenceAdapter } from "./adapters/recurrence";
import { htmlCalendarAdapter } from "./adapters/html-calendar";

export * from "./types";

export const eventAdapters: Record<string, Adapter<EventItem>> = {
  meetup: meetupAdapter,
  luma: lumaAdapter,
  eventbrite: eventbriteAdapter,
  siliconSlopes: siliconSlopesAdapter,
  substack: substackAdapter,
  utahGeekEvents: utahGeekEventsAdapter,
  recurrence: recurrenceAdapter,
  htmlCalendar: htmlCalendarAdapter,
};

export function getEventAdapter(name: string): Adapter<EventItem> {
  const adapter = eventAdapters[name];
  if (!adapter) throw new Error(`Unknown event adapter: ${name}`);
  return adapter;
}
