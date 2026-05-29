import type { Adapter, EventItem } from "./types";
import { meetupAdapter } from "./adapters/meetup";
import { lumaAdapter } from "./adapters/luma";
import { eventbriteAdapter } from "./adapters/eventbrite";

export * from "./types";

export const eventAdapters: Record<string, Adapter<EventItem>> = {
  meetup: meetupAdapter,
  luma: lumaAdapter,
  eventbrite: eventbriteAdapter,
};

export function getEventAdapter(name: string): Adapter<EventItem> {
  const adapter = eventAdapters[name];
  if (!adapter) throw new Error(`Unknown event adapter: ${name}`);
  return adapter;
}
