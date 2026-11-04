import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { guardedLoader } from "../src/lib/refill-guard";
import { TimeoutError, withTimeout } from "../src/lib/deadline";
import { REFILL_TIMEOUT_MS } from "../src/lib/public-data-timing";
import { FAILURE_STREAK_WINDOW_MS } from "../src/lib/public-events";

/* The guards around a public dataset refill, driven by fake timers and a
   fake clock. "store" stands in for unstable_cache writing the result:
   it only ever sees what the guarded loader resolves with. */

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

test("withTimeout: a result in time passes through, a late one is dropped", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(await withTimeout(Promise.resolve(1), 100, "x"), 1);
    const slow = deferred<number>();
    const p = withTimeout(slow.promise, 100, "x");
    const seen: unknown[] = [];
    p.then((v) => seen.push(v), (e) => seen.push(e));
    mock.timers.tick(100);
    await flush();
    slow.resolve(2);
    await flush();
    assert.equal(seen.length, 1);
    assert.ok(seen[0] instanceof TimeoutError);
  } finally {
    mock.timers.reset();
  }
});

test("refill guard: a refill slower than REFILL_TIMEOUT_MS fails and is never stored", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let clock = 0;
  try {
    const db = deferred<string>();
    const load = guardedLoader(() => db.promise, { timeoutMs: REFILL_TIMEOUT_MS, now: () => clock });
    const stored: string[] = [];
    const errors: unknown[] = [];
    load().then((v) => stored.push(v), (e) => errors.push(e));
    clock += REFILL_TIMEOUT_MS - 1;
    mock.timers.tick(REFILL_TIMEOUT_MS - 1);
    await flush();
    assert.equal(errors.length, 0, "still waiting just before the limit");
    clock += 1;
    mock.timers.tick(1);
    await flush();
    assert.ok(errors[0] instanceof TimeoutError);
    /* The database answers late, with data read before some write. */
    db.resolve("pre-write snapshot");
    await flush();
    assert.deepEqual(stored, [], "the late result reaches nobody");
    assert.equal(load.state().failures, 1, "and the timeout counts as a failure in a row");
  } finally {
    mock.timers.reset();
  }
});

test("refill guard: synchronous work after the database answers cannot carry a refill past the limit", async () => {
  /* The database answers at 7 s; encoding the rows then takes 2 s of
     synchronous CPU, during which the 8 s timer cannot fire. The result
     is ready at 9 s and must be refused, or a refill that read before a
     write could be stored after the delayed mark. */
  mock.timers.enable({ apis: ["setTimeout"] });
  let clock = 0;
  try {
    const db = deferred<string>();
    const load = guardedLoader(
      async () => {
        const rows = await db.promise;
        clock += 2_000; // the encode: time passes, no timer runs
        return `encoded ${rows}`;
      },
      { timeoutMs: REFILL_TIMEOUT_MS, now: () => clock },
    );
    const stored: string[] = [];
    const errors: unknown[] = [];
    load().then((v) => stored.push(v), (e) => errors.push(e));
    clock += 7_000;
    mock.timers.tick(7_000);
    db.resolve("pre-write snapshot");
    await flush();
    assert.deepEqual(stored, [], "a result 1 s past the limit is never stored");
    assert.ok(errors[0] instanceof TimeoutError);
    assert.equal(load.state().failures, 1);
  } finally {
    mock.timers.reset();
  }
});

test("refill guard: a result that is ready in time still passes", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let clock = 0;
  try {
    const db = deferred<string>();
    const load = guardedLoader(
      async () => {
        const rows = await db.promise;
        clock += 1_000;
        return `encoded ${rows}`;
      },
      { timeoutMs: REFILL_TIMEOUT_MS, now: () => clock },
    );
    const p = load();
    clock += REFILL_TIMEOUT_MS - 1_000;
    mock.timers.tick(REFILL_TIMEOUT_MS - 1_000);
    db.resolve("rows");
    assert.equal(await p, "encoded rows", "ready at exactly the limit");
  } finally {
    mock.timers.reset();
  }
});

test("withTimeout: with real timers, a blocking encode after the answer is refused", async () => {
  /* The verifier's reproduction: the answer comes at 20 ms, then 150 ms
     of synchronous work; with a 100 ms limit the timer has not had a
     turn yet when the work resolves. */
  const busy = (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin */
    }
  };
  const work = new Promise<void>((r) => setTimeout(r, 20)).then(() => {
    busy(150);
    return "pre-write snapshot";
  });
  await assert.rejects(withTimeout(work, 100, "refill"), TimeoutError);
});

test("refill guard: callers that join a running load share it and its time limit", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let calls = 0;
    const db = deferred<string>();
    const load = guardedLoader(
      () => {
        calls++;
        return db.promise;
      },
      { timeoutMs: 8000, now: () => 0 },
    );
    const results: unknown[] = [];
    load().then((v) => results.push(v), (e) => results.push(e));
    mock.timers.tick(7000);
    /* Joins 7 s in: it gets the shared load, so it also fails at 8 s,
       not at 15 s. */
    load().then((v) => results.push(v), (e) => results.push(e));
    mock.timers.tick(1000);
    await flush();
    assert.equal(calls, 1);
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r instanceof TimeoutError));
  } finally {
    mock.timers.reset();
  }
});

test("refill guard: the first failure retries on the next call, later ones back off", async () => {
  let clock = 1_000_000;
  let calls = 0;
  let fail = true;
  const load = guardedLoader(
    async () => {
      calls++;
      if (fail) throw new Error("db down");
      return "ok";
    },
    { timeoutMs: 8000, now: () => clock },
  );
  await assert.rejects(load(), /db down/);
  assert.equal(calls, 1);
  /* No wait after the first failure: a refill that read before a write
     and failed must not keep the reads after the writer's delayed mark
     from refilling (lib/public-data-timing.ts). */
  await assert.rejects(load(), /db down/);
  assert.equal(calls, 2, "one more try right away");
  clock += 29_999;
  await assert.rejects(load(), /backing off/);
  assert.equal(calls, 2, "no database call while backing off");
  clock += 1;
  await assert.rejects(load(), /db down/);
  assert.equal(calls, 3);
  clock += 59_999;
  await assert.rejects(load(), /backing off/);
  clock += 1;
  fail = false;
  assert.equal(await load(), "ok");
  assert.deepEqual(load.state(), { failures: 0, retryAt: 0, inflight: false });
});

test("refill guard: a database that keeps failing gets one extra try, not one per request", async () => {
  /* 2,000 requests a minute for an hour against a database that never
     answers in time. */
  let clock = 0;
  let calls = 0;
  const load = guardedLoader(
    async () => {
      calls++;
      throw new Error("db down");
    },
    { timeoutMs: 8000, now: () => clock },
  );
  const loadsAt: number[] = [];
  for (; clock < 3_600_000; clock += 30) {
    const before = calls;
    await load().catch(() => {});
    if (calls > before) loadsAt.push(clock);
  }
  /* 0 and 30 ms (the free retry), then 30 s, 60 s, 120 s, 240 s, 480 s
     and 900 s apart. */
  const gaps = loadsAt.slice(1).map((t, i) => t - loadsAt[i]);
  assert.deepEqual(gaps.slice(0, 7), [30, 30_000, 60_000, 120_000, 240_000, 480_000, 900_000]);
  assert.ok(gaps.slice(6).every((g) => g === 900_000));
  assert.ok(calls <= 9, `${calls} loads in an hour`);
});

test("refill guard: a load that throws synchronously still counts as a failure", async () => {
  const load = guardedLoader<string>(
    () => {
      throw new Error("sync");
    },
    { timeoutMs: 8000, now: () => 0 },
  );
  await assert.rejects(load(), /sync/);
  assert.equal(load.state().failures, 1);
});

test("refill guard: an old failure does not arm a backoff for the next one", async () => {
  /* A copy fails once, then sits idle for hours while other copies or
     instances refill the shared entry. Its next failure (perhaps a refill
     that read before a write and timed out) must count as the first in a
     row, so the reads after the writer's delayed mark still refill. */
  let clock = 1_000_000;
  let calls = 0;
  const load = guardedLoader<string>(
    async () => {
      calls++;
      throw new Error("db down");
    },
    { timeoutMs: 8000, now: () => clock },
  );
  await assert.rejects(load(), /db down/);
  assert.equal(load.state().failures, 1);
  clock += 3 * 60 * 60_000;
  await assert.rejects(load(), /db down/);
  assert.equal(load.state().failures, 1, "a new streak");
  assert.equal(load.state().retryAt, clock, "no backoff");
  await assert.rejects(load(), /db down/);
  assert.equal(calls, 3, "the next read still tries");
});

test("refill guard: the streak window ends just past FAILURE_STREAK_WINDOW_MS", async () => {
  let clock = 0;
  const load = guardedLoader<string>(
    async () => {
      throw new Error("db down");
    },
    { timeoutMs: 8000, now: () => clock },
  );
  await assert.rejects(load(), /db down/);
  clock += FAILURE_STREAK_WINDOW_MS;
  await assert.rejects(load(), /db down/);
  assert.equal(load.state().failures, 2, "at the window edge the streak continues");
  assert.equal(load.state().retryAt, clock + 30_000);
  clock += 30_000 + FAILURE_STREAK_WINDOW_MS + 1;
  await assert.rejects(load(), /db down/);
  assert.equal(load.state().failures, 1, "past the window a new streak starts");
});
