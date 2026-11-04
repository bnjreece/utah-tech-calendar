/* Public read API: reads the shared cached dataset, never the database.
   Each call filters the dataset in memory against the time at render
   (lib/public-events.ts holds the rules). Admin pages and writers query
   lib/db directly. */
import type { FilterState } from "./filters";
import { getPublicData } from "./public-data";
import {
  cityCounts,
  cityEvents,
  cityFromSlug,
  countPublicEvents,
  eventsInRange,
  filterPublicEvents,
  findEventByParam,
  groupBySlug,
  groupCounts,
  groupUpcoming,
  recentlyAdded,
  sourceCounts,
  tagCounts,
  tagFromUpcomingSlug,
  type EventWithGroup,
  type PublicGroup,
} from "./public-events";

export type { EventWithGroup, PublicGroup };

export async function queryEvents(filters: FilterState, limit = 200): Promise<EventWithGroup[]> {
  return filterPublicEvents(await getPublicData(), filters, { now: new Date(), limit });
}

export async function countEvents(filters: FilterState): Promise<number> {
  return countPublicEvents(await getPublicData(), filters, new Date());
}

/* RSS "what's new": sorted by created_at desc so a reader's "5 new today"
   grouping matches reality. */
export async function getRecentlyAddedEvents(limit = 50): Promise<EventWithGroup[]> {
  return recentlyAdded(await getPublicData(), new Date(), limit);
}

/* A slug-prefix param ("utahjs-meetup-june-abcd1234") or a legacy raw
   UUID. Hidden and pending events are not public, so they return null. */
export async function getPublicEventByParam(param: string): Promise<EventWithGroup | null> {
  return findEventByParam(await getPublicData(), param);
}

export async function getGroupBySlug(slug: string): Promise<PublicGroup | null> {
  return groupBySlug(await getPublicData(), slug);
}

export async function getUpcomingEventsForGroup(groupId: string): Promise<EventWithGroup[]> {
  return groupUpcoming(await getPublicData(), groupId, new Date(), 50);
}

export async function findCityBySlug(slug: string): Promise<string | null> {
  return cityFromSlug(await getPublicData(), slug);
}

export async function getUpcomingCityEvents(city: string): Promise<EventWithGroup[]> {
  return cityEvents(await getPublicData(), city, new Date());
}

export async function findUpcomingTagBySlug(slug: string): Promise<string | null> {
  return tagFromUpcomingSlug(await getPublicData(), slug, new Date());
}

export async function getEventsInRange(from: Date, to: Date): Promise<EventWithGroup[]> {
  return eventsInRange(await getPublicData(), from, to);
}

export async function countEventsInRange(from: Date, to: Date): Promise<number> {
  return eventsInRange(await getPublicData(), from, to).length;
}

export async function getEnabledSourceCount(): Promise<number> {
  return (await getPublicData()).enabledSourceCount;
}

export async function getSourceCounts(): Promise<Array<{ source: string; count: number }>> {
  return sourceCounts(await getPublicData(), new Date());
}

export async function getGroupCounts(): Promise<Array<{ slug: string; name: string; count: number }>> {
  return groupCounts(await getPublicData(), new Date());
}

/* NULL-city events surface as a synthetic "Unknown" entry, parallel with
   the Unknown UtahRegion shown as "Location TBD" in the FeedBuilder. */
export async function getCityCounts(): Promise<Array<{ city: string; count: number }>> {
  return cityCounts(await getPublicData(), new Date());
}

export async function getTagCounts(): Promise<Array<{ tag: string; count: number }>> {
  return tagCounts(await getPublicData(), new Date());
}
