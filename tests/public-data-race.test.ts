import assert from "node:assert/strict";
import { test } from "node:test";
import { RECHECK_DELAY_MS, REFILL_TIMEOUT_MS, STORE_MARGIN_MS } from "../src/lib/public-data-timing";
import { nextBackoffMs } from "../src/lib/public-events";

/* The late-refill race (lib/public-data-timing.ts), checked over every
   timing on a grid with an injected clock.

   The data cache rule, as in Next 16.4.2
   (server/lib/incremental-cache/tags-manifest.external.js areTagsStale)
   and as Vercel describes its tag store: an entry is stale once the tag
   was marked after the entry was stored. So a stored entry that lacks a
   write stays fresh until the next mark. After a writer's last mark, the
   next one comes from the next cron (up to 3 h later).

   A refill starts at `start`, reads the database at `read` (between
   start and its end), returns after `duration` (queries and encoding),
   and is stored `storeLatency` later. lib/refill-guard.ts fails any
   refill whose duration passes REFILL_TIMEOUT_MS, so it is never stored;
   since round 2 that holds for synchronous encoding too (lib/deadline.ts
   withTimeout checks the time again when the refill returns). The write
   commits at W = 0. */

interface Protocol {
  name: string;
  /* When each mark of one write takes effect, relative to the commit. */
  marks: (flushLag: number) => number[];
}

/* Route handlers and server actions: publicDataChanged() marks when the
   handler returns (`flushLag` after the commit) and again from after(). */
const handlerProtocol: Protocol = {
  name: "route handler / server action",
  marks: (flushLag) => [flushLag, flushLag + RECHECK_DELAY_MS],
};
/* A page render (the moderation link): only the delayed mark, sent when
   the after() work ends. */
const renderProtocol: Protocol = {
  name: "page render",
  marks: (flushLag) => [flushLag + RECHECK_DELAY_MS],
};

interface Timing {
  start: number;
  read: number;
  duration: number;
  storeLatency: number;
  flushLag: number;
}

/* A stored entry without the write that is still fresh after the last
   mark, or null. */
function staleWinner(p: Protocol, t: Timing, timeoutMs: number | null): Timing | null {
  if (timeoutMs !== null && t.duration > timeoutMs) return null; // refill failed, nothing stored
  if (t.read >= 0) return null; // it saw the write
  const storedAt = t.start + t.duration + t.storeLatency;
  const lastMark = Math.max(...p.marks(t.flushLag));
  return storedAt > lastMark ? t : null;
}

function* timings(maxDuration: number): Generator<Timing> {
  const step = 250;
  for (let start = -30_000; start <= 30_000; start += step) {
    for (let duration = 0; duration <= maxDuration; duration += step) {
      /* Reading at the very start is the worst case for a refill that
         misses the write; the end is checked too. */
      for (const read of new Set([start, start + duration])) {
        for (const storeLatency of [0, 1000, 3000, STORE_MARGIN_MS]) {
          for (const flushLag of [0, 500, 3000]) {
            yield { start, read, duration, storeLatency, flushLag };
          }
        }
      }
    }
  }
}

for (const p of [handlerProtocol, renderProtocol]) {
  test(`race: with the refill limit, no stale entry outlives the marks (${p.name})`, () => {
    let checked = 0;
    for (const t of timings(30_000)) {
      checked++;
      const bad = staleWinner(p, t, REFILL_TIMEOUT_MS);
      assert.equal(bad, null, `stale entry survives: ${JSON.stringify(bad)}`);
    }
    assert.ok(checked > 100_000);
  });
}

test("race: the check finds the bug without the refill limit", () => {
  const found = [...timings(30_000)].some((t) => staleWinner(handlerProtocol, t, null));
  assert.ok(found, "a refill longer than the recheck delay would win");
});

test("race: the check finds the bug with a single immediate mark", () => {
  const single: Protocol = { name: "one mark", marks: (lag) => [lag] };
  const found = [...timings(REFILL_TIMEOUT_MS)].some((t) => staleWinner(single, t, REFILL_TIMEOUT_MS));
  assert.ok(found, "the original round-1 race");
});

/* ISR regeneration and the refill backoff (round 2 of the review).

   unstable_cache, for a consumer that will store what it renders (an ISR
   regeneration, work unit "prerender-legacy"), waits for the refill of a
   stale entry instead of answering from it; but if that refill fails it
   hands back the stale entry, and the page built from it is stored. A
   page stored after the last mark is fresh. So if the instance is backing
   off when a page regenerates after the last mark, the refill fails at
   once and the page is stored with the pre-write data, as fresh, until
   its own revalidate (5 min to 1 h).

   One guard copy, the worst case: the refill that read before the write
   and the page regeneration run on the same guard copy, so they share its
   backoff (lib/refill-guard.ts keeps one per server bundle per instance).
   The precondition of the invariant in lib/public-data-timing.ts holds:
   the copy had no other failure in the streak window before this refill,
   and refills it starts after the write succeed. A copy that failed long
   before is covered by the streak window (tests/refill-guard.test.ts). A page is stored `pageLatency` after it gets its data.

   Pages that start while the pre-write refill runs join it and get its
   data (or the stale entry) when it ends; pages that start at or after
   the last mark refill unless the instance is backing off. A page that
   read the entry in the moment just before the last mark is the window
   the invariant leaves out. */
type Backoff = (failures: number) => number;

function stalePage(
  p: Protocol,
  t: Timing,
  regenAt: number,
  pageLatency: number,
  errors: boolean,
  backoff: Backoff,
): { regenAt: number; pageLatency: number; errors: boolean; storedAt: number; t: Timing } | null {
  if (t.read >= 0) return null; // the refill saw the write
  const lastMark = Math.max(...p.marks(t.flushLag));
  /* It fails by passing the limit, or with an error at its end. */
  const failed = t.duration > REFILL_TIMEOUT_MS || errors;
  const ends = t.start + (failed ? REFILL_TIMEOUT_MS : t.duration);
  let gotDataAt: number;
  if (regenAt >= t.start && regenAt < ends) {
    /* Joins the running refill: pre-write data either way (its result,
       or the stale entry if it failed). */
    gotDataAt = ends;
  } else if (regenAt >= lastMark) {
    if (!failed) return null; // entry stale since the last mark: refills
    const retryAt = ends + backoff(1); // the first failure in a row
    if (regenAt >= retryAt) return null; // refills, after the write
    gotDataAt = regenAt; // backing off: the stale entry at once
  } else {
    return null; // the window the invariant leaves out, see above
  }
  const storedAt = gotDataAt + pageLatency;
  return storedAt > lastMark ? { regenAt, pageLatency, errors, storedAt, t } : null;
}

interface PageTiming {
  t: Timing;
  regenAt: number;
  pageLatency: number;
  errors: boolean;
}

function* pageTimings(): Generator<PageTiming> {
  for (const t of timings(30_000)) {
    if (t.read >= 0 || t.storeLatency !== STORE_MARGIN_MS) continue;
    const lastMark = t.flushLag + RECHECK_DELAY_MS;
    for (const errors of [false, true]) {
      for (const pageLatency of [0, 1000, 3000]) {
        /* While the refill runs, and for a minute after the last mark. */
        for (let regenAt = t.start; regenAt < t.start + REFILL_TIMEOUT_MS; regenAt += 500) {
          yield { t, regenAt, pageLatency, errors };
        }
        for (let regenAt = lastMark; regenAt <= lastMark + 60_000; regenAt += 1000) {
          yield { t, regenAt, pageLatency, errors };
        }
      }
    }
  }
}

/* The backoff before round 2: 30 s after the first failure. */
const oldBackoff: Backoff = (n) => (n <= 0 ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (n - 1)));

for (const p of [handlerProtocol, renderProtocol]) {
  test(`race: no ISR page regenerated after the last mark is built from pre-write data (${p.name})`, () => {
    let checked = 0;
    for (const { t, regenAt, pageLatency, errors } of pageTimings()) {
      checked++;
      const bad = stalePage(p, t, regenAt, pageLatency, errors, nextBackoffMs);
      assert.equal(bad, null, `stale page: ${JSON.stringify(bad)}`);
    }
    assert.ok(checked > 100_000, `${checked}`);
  });
}

test("race: the check finds the ISR page bug with a 30 s backoff after the first failure", () => {
  let found: ReturnType<typeof stalePage> = null;
  for (const { t, regenAt, pageLatency, errors } of pageTimings()) {
    found ??= stalePage(handlerProtocol, t, regenAt, pageLatency, errors, oldBackoff);
    if (found) break;
  }
  assert.ok(found, "the reviewer's case: refill times out around the write, page regenerates after the delayed mark");
});

test("race: the recheck delay covers the refill limit plus the store margin", () => {
  assert.ok(RECHECK_DELAY_MS >= REFILL_TIMEOUT_MS + STORE_MARGIN_MS);
  assert.ok(STORE_MARGIN_MS >= 5_000, "room for a slow data cache write");
});
