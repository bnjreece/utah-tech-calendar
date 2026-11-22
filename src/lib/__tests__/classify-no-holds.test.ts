/* Astra 2026-11-22 round 1: with no human review, a row must never be marked
   checked without the decision it needs. */
import { describe, expect, mock, test } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {},
  events: {},
  sources: {},
  pendingSubmissions: {},
  reviewDecisions: {},
  adminSettings: {},
}));

const { leaveUnscored, REDECIDE_LIMIT, SCREEN_ABORT_AT } = await import("@/lib/classify");
const { MAX_PUBLISH_PER_RUN } = await import("@/lib/autopilot");

const pending = { status: "pending", statusLocked: false, source: "eventbrite" };
const approved = { status: "approved", statusLocked: false, source: "luma" };
const run = (published: number, screened: number, gateEnabled = true) => ({ gateEnabled, published, screened });

describe("leaveUnscored", () => {
  test("nothing is skipped before the cap or the breaker", () => {
    expect(leaveUnscored(pending, run(0, 0))).toBe(false);
    expect(leaveUnscored(approved, run(0, SCREEN_ABORT_AT - 1))).toBe(false);
  });

  test("pending rows wait once the publish cap or the breaker is reached", () => {
    expect(leaveUnscored(pending, run(MAX_PUBLISH_PER_RUN, 0))).toBe(true);
    expect(leaveUnscored(pending, run(0, SCREEN_ABORT_AT))).toBe(true);
  });

  test("after 30 hides an approved row the gate could screen is left for the next run", () => {
    expect(leaveUnscored(approved, run(0, SCREEN_ABORT_AT))).toBe(true);
    /* The publish cap does not stop the gate. */
    expect(leaveUnscored(approved, run(MAX_PUBLISH_PER_RUN, 0))).toBe(false);
  });

  test("rows the gate never acts on are always scored", () => {
    const tripped = run(MAX_PUBLISH_PER_RUN, SCREEN_ABORT_AT);
    expect(leaveUnscored({ ...approved, statusLocked: true }, tripped)).toBe(false);
    expect(leaveUnscored({ ...approved, source: "manual" }, tripped)).toBe(false);
    expect(leaveUnscored({ ...pending, status: "hidden" }, tripped)).toBe(false);
    expect(leaveUnscored(pending, run(MAX_PUBLISH_PER_RUN, SCREEN_ABORT_AT, false))).toBe(false);
  });
});

describe("stored-verdict pass", () => {
  test("is bounded per run and never calls the model", async () => {
    expect(REDECIDE_LIMIT).toBe(50);
    /* The pass reuses llm_verdict; classify.ts has exactly one model call
       site (classifyEvent inside the scoring loop). */
    const src = await Bun.file(new URL("../classify.ts", import.meta.url)).text();
    const pass = src.slice(src.indexOf("Stored-verdict pass."), src.indexOf("screen circuit breaker hit"));
    expect(pass).toContain("r.llmVerdict as EventVerdict");
    expect(pass).not.toContain("classifyEvent(");
  });
});
