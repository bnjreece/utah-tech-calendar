import assert from "node:assert/strict";
import { test } from "node:test";
import { deadlineAt, nextCallTimeoutMs, routeDeadline } from "../src/lib/deadline";
import { CLASSIFY_CALL_TIMEOUT_MS, CLASSIFY_MIN_CALL_MS } from "../src/lib/classify-limits";
import { CLASSIFY_CLOSING_RESERVE_MS, RECHECK_DELAY_MS, SCRAPE_CLOSING_RESERVE_MS } from "../src/lib/public-data-timing";

/* The classify loop's time budget (lib/classify.ts), with an injected
   clock: whatever the calls cost, the loop leaves the closing reserve
   for the invalidation, its delayed mark and the response. */

const MAX_DURATION_S = 300;

/* The loop as lib/classify.ts runs it: ask for a time limit before each
   call; stop on null; a call may use all of its limit. */
function runLoop(opts: {
  clock: { t: number };
  deadline: ReturnType<typeof deadlineAt>;
  reserveMs: number;
  rows: number;
  callCost: (limitMs: number, i: number) => number;
  rowOverheadMs?: number;
}) {
  let done = 0;
  let deferred = 0;
  const limits: number[] = [];
  for (let i = 0; i < opts.rows; i++) {
    const limit = nextCallTimeoutMs(opts.deadline, {
      reserveMs: opts.reserveMs,
      maxCallMs: CLASSIFY_CALL_TIMEOUT_MS,
      minCallMs: CLASSIFY_MIN_CALL_MS,
    });
    if (limit === null) {
      deferred = opts.rows - i;
      break;
    }
    limits.push(limit);
    opts.clock.t += Math.min(limit, opts.callCost(limit, i));
    done++;
  }
  return { done, deferred, limits, remaining: opts.deadline.remainingMs() };
}

test("deadline: the reported scenario, a scrape ending at 170 s and every call slow", () => {
  const clock = { t: 0 };
  const deadline = routeDeadline(MAX_DURATION_S, () => clock.t);
  clock.t = 170_000;
  const r = runLoop({ clock, deadline, reserveMs: SCRAPE_CLOSING_RESERVE_MS, rows: 25, callCost: (l) => l });
  assert.ok(r.done < 25 && r.deferred > 0, `done ${r.done}, deferred ${r.deferred}`);
  assert.ok(r.remaining >= SCRAPE_CLOSING_RESERVE_MS, `${r.remaining} ms left`);
  assert.ok(r.limits.every((l) => l <= CLASSIFY_CALL_TIMEOUT_MS));
});

test("deadline: exhaustion at every start time and call cost leaves the reserve", () => {
  for (const reserveMs of [SCRAPE_CLOSING_RESERVE_MS, CLASSIFY_CLOSING_RESERVE_MS]) {
    for (let startAt = 0; startAt <= 320_000; startAt += 5_000) {
      for (const cost of [1, 4_999, 5_000, 12_345, 19_999, 20_000, 60_000]) {
        const clock = { t: 0 };
        const deadline = routeDeadline(MAX_DURATION_S, () => clock.t);
        clock.t = startAt;
        const before = deadline.remainingMs();
        const r = runLoop({ clock, deadline, reserveMs, rows: 150, callCost: () => cost });
        if (r.done > 0) {
          assert.ok(r.remaining >= reserveMs, `start ${startAt}, cost ${cost}: ${r.remaining} ms left`);
        } else {
          assert.ok(before - reserveMs < CLASSIFY_MIN_CALL_MS, "it only skips the loop when there is no room");
        }
      }
    }
  }
});

test("deadline: a fast batch is not cut short", () => {
  const clock = { t: 0 };
  const deadline = routeDeadline(MAX_DURATION_S, () => clock.t);
  clock.t = 60_000;
  const r = runLoop({ clock, deadline, reserveMs: SCRAPE_CLOSING_RESERVE_MS, rows: 25, callCost: () => 2_000 });
  assert.equal(r.done, 25);
  assert.equal(r.deferred, 0);
  assert.ok(r.limits.every((l) => l === CLASSIFY_CALL_TIMEOUT_MS));
});

test("deadline: the last call's limit shrinks to what is left", () => {
  const clock = { t: 0 };
  const deadline = deadlineAt(100_000, () => clock.t);
  clock.t = 100_000 - SCRAPE_CLOSING_RESERVE_MS - 7_000;
  const budget = { reserveMs: SCRAPE_CLOSING_RESERVE_MS, maxCallMs: CLASSIFY_CALL_TIMEOUT_MS, minCallMs: CLASSIFY_MIN_CALL_MS };
  assert.equal(nextCallTimeoutMs(deadline, budget), 7_000);
  clock.t += 2_001;
  assert.equal(nextCallTimeoutMs(deadline, budget), null);
});

test("deadline: the reserves hold the delayed mark plus room for the closing work", () => {
  assert.ok(SCRAPE_CLOSING_RESERVE_MS >= RECHECK_DELAY_MS + 20_000);
  assert.ok(CLASSIFY_CLOSING_RESERVE_MS >= RECHECK_DELAY_MS + 10_000);
  /* routeDeadline counts the time before the handler ran. */
  const clock = { t: 1_000 };
  assert.equal(routeDeadline(300, () => clock.t).remainingMs(), 295_000);
});
