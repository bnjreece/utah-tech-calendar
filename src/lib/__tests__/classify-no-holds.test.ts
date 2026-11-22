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

const { approvedRecovery, inputFingerprint, leaveUnscored, pendingRecovery, REDECIDE_LIMIT, SCREEN_ABORT_AT } = await import("@/lib/classify");
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

const row = {
  title: "Rust Night",
  description: "Monthly Rust meetup with two talks.",
  venueName: "Kiln",
  city: "Lehi",
  source: "luma",
  link: "https://lu.ma/rust",
};
const verdict = (over: Record<string, unknown> = {}) => ({
  isTechRelevant: true,
  isSpam: false,
  isOnline: false,
  isPaid: false,
  category: "developer meetup",
  suggestedTags: [],
  confidence: 0.95,
  reasoning: "",
  inputsHash: inputFingerprint(row),
  ...over,
});

describe("stored-verdict pass", () => {
  test("is bounded per run", () => expect(REDECIDE_LIMIT).toBe(50));

  test("the fingerprint covers what the model sees, and only that", () => {
    expect(inputFingerprint(row)).toBe(inputFingerprint({ ...row }));
    for (const k of ["title", "description", "venueName", "city", "source", "link"] as const)
      expect(inputFingerprint({ ...row, [k]: "changed" })).not.toBe(inputFingerprint(row));
    /* The model sees the first 800 characters of the description. */
    const long = "x".repeat(800);
    expect(inputFingerprint({ ...row, description: long + "a" })).toBe(inputFingerprint({ ...row, description: long + "b" }));
  });

  test("a pending row unchanged since scoring is decided from its saved verdict (publish-off recovery, interrupted run)", () => {
    expect(pendingRecovery(verdict(), row)).toBe("decide");
  });

  test("a pending row that changed since scoring is scored again, never decided on the old verdict", () => {
    expect(pendingRecovery(verdict(), { ...row, title: "Rust Night: sales demo" })).toBe("rescore");
    expect(pendingRecovery(verdict(), { ...row, description: "Buy our CRM." })).toBe("rescore");
  });

  test("a verdict stored before fingerprints existed is scored again", () => {
    expect(pendingRecovery(verdict({ inputsHash: undefined }), row)).toBe("rescore");
    expect(pendingRecovery(null, row)).toBe("rescore");
  });

  test("an approved row is screened from its saved verdict only on unchanged inputs and at today's bar", () => {
    const spam = verdict({ isSpam: true, isTechRelevant: false, category: "cert-spam", confidence: 0.95 });
    expect(approvedRecovery(spam, row, 0.92)).toBe("screen");
    /* Bar raised above the verdict's confidence. */
    expect(approvedRecovery(spam, row, 0.99)).toBe("none");
    /* Changed since scoring. */
    expect(approvedRecovery(spam, { ...row, title: "Rust Night v2" }, 0.92)).toBe("none");
    /* Scored before fingerprints (went through the old gate). */
    expect(approvedRecovery({ ...spam, inputsHash: undefined }, row, 0.92)).toBe("none");
    /* A yes is never screened. */
    expect(approvedRecovery(verdict(), row, 0.92)).toBe("none");
  });
});
