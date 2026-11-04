/* Time limits for work that must finish inside a known window. Pure: no
   next/* and no database import, so tests load it directly with a fake
   clock. */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/* Settles with `work`, or rejects with a TimeoutError once `ms` have
   passed, whichever comes first. The limit is hard: a result that
   arrives after `ms` is rejected too. The timer alone is not enough,
   because a timer cannot fire while synchronous code runs: work whose
   database answer comes in time and is then encoded for seconds would
   resolve before the timer gets its turn. So the elapsed time is checked
   again once `work` resolves, by `now`, from the call.

   A late result is dropped: the returned promise has already rejected,
   so nothing downstream ever sees it. The work itself keeps running (a
   database fetch cannot be recalled), which is fine because its result
   goes nowhere. */
export function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
  now: () => number = Date.now,
): Promise<T> {
  const started = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  const checked = work.then((value) => {
    if (now() - started > ms) throw new TimeoutError(label, ms);
    return value;
  });
  return Promise.race([checked, timeout]).finally(() => clearTimeout(timer));
}

/* The time left before a function's maxDuration, for loops that must
   stop early enough to run their closing steps. */
export interface Deadline {
  /* Milliseconds until the deadline (negative once past). */
  remainingMs(): number;
}

export function deadlineAt(endMs: number, now: () => number = Date.now): Deadline {
  return { remainingMs: () => endMs - now() };
}

export interface CallBudget {
  /* Time kept back for the steps after the loop. */
  reserveMs: number;
  /* The longest one call may take. */
  maxCallMs: number;
  /* Below this, starting a call is pointless. */
  minCallMs: number;
}

/* The time limit for the next call in a loop, or null when there is not
   enough time left to start one and still keep `reserveMs` for what
   comes after. Never longer than the time left minus the reserve, so a
   call that runs to its limit still leaves the reserve. */
export function nextCallTimeoutMs(deadline: Deadline, budget: CallBudget): number | null {
  const available = deadline.remainingMs() - budget.reserveMs;
  if (available < budget.minCallMs) return null;
  return Math.min(budget.maxCallMs, available);
}

/* The deadline of a route invocation that began just now, from its
   maxDuration in seconds. Takes 5 s off for the time before the handler
   ran (cold start, module load), which also counts toward maxDuration. */
export function routeDeadline(maxDurationSeconds: number, now: () => number = Date.now): Deadline {
  return deadlineAt(now() + maxDurationSeconds * 1000 - 5_000, now);
}
