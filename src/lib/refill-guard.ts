import { withTimeout } from "./deadline";
import { FAILURE_STREAK_WINDOW_MS, nextBackoffMs } from "./public-events";

/* The guards around a public dataset refill (lib/public-data.ts). Pure:
   no next/* and no database import, so tests drive it with fake timers
   and a fake clock.

   - Time limit. A refill that has not finished within `timeoutMs`
     rejects, and so does one that finishes later than that (the check
     runs again when the load resolves, so synchronous work inside the
     load cannot carry it past the limit). unstable_cache then keeps
     serving the stale entry and never stores what the refill read. The
     delayed second mark in lib/public-data-invalidate.ts relies on this
     bound: a refill that read the database before a write is always
     stored (or dropped) before that mark.
   - Backoff. While an entry is stale, unstable_cache starts a refill on
     every read, and a failed one stores nothing, so the next read tries
     again. If the database keeps failing, every public request would
     send queries and keep Neon awake. After the second failure in a
     row, calls fail fast without loading: 30 s, doubling up to 15 min,
     reset by a success (lib/public-events.ts nextBackoffMs). The first
     failure in a row waits for nothing, so a refill that read before a
     write and failed does not start a backoff that outlasts the delayed
     mark (lib/public-data-timing.ts). The count is per guard copy (each
     server bundle that imports lib/public-data.ts has its own, on every
     instance), and a copy only sees its own loads, so a failure more than
     FAILURE_STREAK_WINDOW_MS after the previous one starts a new streak.
   - One load at a time. Next dedupes a refill only within one render.
     After an invalidation, every page regenerating at once would run its
     own refill, so concurrent calls share one load. The time limit runs
     from the start of the shared load, so a caller that joins late still
     gets data no older than `timeoutMs`. */

export interface GuardedLoaderOptions {
  timeoutMs: number;
  now?: () => number;
  label?: string;
  onFailure?: (failures: number, waitMs: number, err: unknown) => void;
}

export interface GuardedLoader<T> {
  (): Promise<T>;
  /* For tests and logs. */
  state(): { failures: number; retryAt: number; inflight: boolean };
}

export function guardedLoader<T>(load: () => Promise<T>, opts: GuardedLoaderOptions): GuardedLoader<T> {
  const now = opts.now ?? Date.now;
  const label = opts.label ?? "refill";
  let failures = 0;
  let retryAt = 0;
  let lastFailureAt = 0;
  let inflight: Promise<T> | null = null;

  async function attempt(): Promise<T> {
    if (now() < retryAt) {
      throw new Error(`${label} skipped: backing off after a failed refill`);
    }
    try {
      const value = await withTimeout(Promise.resolve().then(load), opts.timeoutMs, label, now);
      failures = 0;
      retryAt = 0;
      return value;
    } catch (err) {
      const t = now();
      if (failures > 0 && t - lastFailureAt > FAILURE_STREAK_WINDOW_MS) failures = 0;
      failures += 1;
      lastFailureAt = t;
      const wait = nextBackoffMs(failures);
      retryAt = t + wait;
      opts.onFailure?.(failures, wait, err);
      throw err;
    }
  }

  const run = (() => {
    inflight ??= attempt().finally(() => {
      inflight = null;
    });
    return inflight;
  }) as GuardedLoader<T>;
  run.state = () => ({ failures, retryAt, inflight: inflight !== null });
  return run;
}
