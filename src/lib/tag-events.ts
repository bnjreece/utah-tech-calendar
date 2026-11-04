import { cache } from "react";
import { getPublicData } from "@/lib/public-data";
import { tagEvents, type EventWithGroup } from "@/lib/public-events";

/* The upcoming in-person events a tag landing page lists (/tag/<tag> and
   /startup-events). Old spellings and special-week titles fold in, the
   same way the sitemap counts them (lib/seo-rules.ts countTagHubs).
   Read from the shared cached dataset, never the database.
   cache(): generateMetadata and the page share one filter per request. */
export const fetchTagEvents = cache(
  async (tag: string): Promise<EventWithGroup[]> =>
    tagEvents(await getPublicData(), tag, new Date()).slice(0, 200),
);
