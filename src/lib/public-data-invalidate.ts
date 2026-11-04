import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { RECHECK_DELAY_MS } from "./public-data-timing";
import { PUBLIC_DATA_TAG } from "./public-events";

/* Marking the public dataset (lib/public-data.ts) stale after a write.
   Every writer of public data (events, groups, enabled sources) calls one
   of the two functions below once its writes have committed, on its
   error path too, since partial writes are already committed.

   Always stale-while-revalidate ("max"), never updateTag or expire: a
   hard expire makes every page regenerated afterwards treat itself as an
   on-demand revalidation, which skips the data cache and queries the
   database once per page.

   Why two marks: see lib/public-data-timing.ts. The first shows the
   change on the next page view; the second, RECHECK_DELAY_MS later,
   replaces any entry from a refill that read the database before the
   write. It costs at most one extra refill, while the database is still
   awake from the write.

   How Next 16.4.2 applies the marks (server/revalidation-utils.js): a
   mark made in a route handler or server action is sent when the
   handler returns. Marks made inside after() callbacks are all sent
   together once every after() callback of that request has finished.
   after() runs within the route's maxDuration, so a route that calls
   these needs RECHECK_DELAY_MS plus a few seconds left. */

export { RECHECK_DELAY_MS };

function markStale(): void {
  revalidateTag(PUBLIC_DATA_TAG, "max");
}

function markAgainLater(): void {
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
    markStale();
  });
}

/* For route handlers and server actions: mark now, and again after
   RECHECK_DELAY_MS. */
export function publicDataChanged(): void {
  markStale();
  markAgainLater();
}

/* For a page render, where revalidateTag cannot run. Both marks would
   land in after() and be sent together at the end, so only the delayed
   one is made: one mark RECHECK_DELAY_MS after the write already
   replaces any refill that read before it. The change shows on the
   first page view after that. */
export function publicDataChangedDuringRender(): void {
  markAgainLater();
}
