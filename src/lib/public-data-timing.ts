/* The timings that keep a slow or failed refill from hiding a write.
   Pure, so tests import it. lib/public-data.ts, lib/refill-guard.ts and
   lib/public-data-invalidate.ts use them; tests/public-data-race.test.ts
   checks the argument below over a grid of timings.

   The race: the data cache treats an entry as fresh when it was stored
   after the tag's last stale mark, and an ISR page the same way. A
   refill that reads the database before a write commits, and is stored
   after the writer marks the tag, would therefore be fresh while missing
   the write (or still showing an event that was just hidden), until the
   next mark or the 6 h TTL.

   The parts:
   - every refill is held to REFILL_TIMEOUT_MS from its start, hard: one
     that has not returned by then fails, and so does one that returns
     later than that, including time spent encoding (lib/deadline.ts
     withTimeout). A failed refill stores nothing;
   - every writer marks the tag right after its writes commit, and again
     RECHECK_DELAY_MS later (lib/public-data-invalidate.ts);
   - the first failed refill in a row starts no backoff
     (lib/public-events.ts nextBackoffMs), so after the last mark the
     next read of the stale entry refills.

   Invariant: if the database is healthy around the write (on the guard
   copy that serves the reads after the last mark, the only failure in
   the FAILURE_STREAK_WINDOW_MS before the first refill it starts after
   the write is, at most, the one refill that read before the write; and
   refills started after the write succeed), then nothing built from data
   read before the write, neither
   the data entry nor an ISR page regenerated after the last mark, is
   stored after the last mark.
   Why: a refill that read before the write started before the first
   mark. It returned within REFILL_TIMEOUT_MS of its start and, as long as
   the store takes at most STORE_MARGIN_MS (assumed, not enforced: see
   the accepted limit below), was stored before the delayed mark
   (RECHECK_DELAY_MS = limit + margin), which makes it stale. Or it
   failed and stored nothing; being the first failure, it left no
   backoff, so after the last mark every read refills from a refill that
   started after the write. unstable_cache makes an ISR regeneration wait
   for that refill instead of using the stale entry.
   Not covered: an ISR render that read the entry just before the last
   mark and is stored just after it (a window of the page's render and
   store time); any tag invalidation has it. Such a page heals at its own
   revalidate (5 min to 1 h). A database that keeps failing serves the
   stale data by design, with backoff, until a refill succeeds.
   Accepted limit (owner decision, 2026-11-04): the store itself. Next writes
   the entry after the refill returns, and nothing here can bound that
   write. If it ever finished after the delayed mark (reproduced in
   review with a simulated slow store, never measured on Vercel), the
   entry built from data read before the write would count as fresh, a
   just-hidden event included. Only a mark that lands after that late
   write makes it stale again: normally the next scrape cron (every 3 h),
   or any other writer, or GET /api/revalidate. Pages then update as
   traffic brings a successful refill and regeneration. There is no
   guaranteed maximum: a cron can run late or fail (Vercel does not
   retry it), and a write can be slower than any later mark. Closing it
   needs a generation marker the refill can check without the database
   (for example Vercel Global Config, formerly Edge Config).

   STORE_MARGIN_MS is the room left for writing the entry after the
   refill returns (one data cache write of a few hundred KB) and for
   clock differences between instances. */

export const REFILL_TIMEOUT_MS = 8_000;
export const STORE_MARGIN_MS = 7_000;
export const RECHECK_DELAY_MS = REFILL_TIMEOUT_MS + STORE_MARGIN_MS;

/* Time a cron keeps back after its classification loop, so a run that
   classifies until the end of its budget still marks the public data
   stale, and still has RECHECK_DELAY_MS for the delayed mark in after(),
   before maxDuration ends the invocation. The classify loop starts no
   call that could eat into it (lib/deadline.ts nextCallTimeoutMs).
   Scrape cron: the expire and submission passes and the response, 30 s.
   Classify cron: the response, 15 s. */
export const SCRAPE_CLOSING_RESERVE_MS = 30_000 + RECHECK_DELAY_MS;
export const CLASSIFY_CLOSING_RESERVE_MS = 15_000 + RECHECK_DELAY_MS;
