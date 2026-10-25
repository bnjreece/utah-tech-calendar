import { describe, expect, mock, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/* The guarded write must refuse a stale decision. These tests render the
   SQL the write sends (no database) and check the tag guard: a scrape that
   adds "blockchain" after classification must make the write a no-op, since
   the crypto hold would now send the row to a human (Astra round 2). */

let captured: SQL | null = null;
/* Results handed back to the next execute calls, in order (default none). */
let queued: unknown[][] = [];
mock.module("@/lib/db", () => ({
  db: {
    execute: async (q: SQL) => {
      captured = q;
      return { rows: queued.shift() ?? [] };
    },
  },
  events: {},
  sources: {},
  pendingSubmissions: {},
  reviewDecisions: {},
}));

const { applyPendingDecision, applyQueueTwinHide, pendingFacts, tagsJson } = await import("@/lib/autopilot-db");

const dialect = new PgDialect();

function baseRow(tags: string[] | null) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Rust Builders Night",
    description: "x",
    venueName: "Kiln",
    city: "Lehi",
    link: "https://lu.ma/x",
    isOnline: false,
    sourceId: "00000000-0000-0000-0000-000000000002",
    source: "luma",
    tags,
    startsAt: new Date("2026-11-12T01:00:00Z"),
  } as never;
}

const verdict = {
  isTechRelevant: true,
  isSpam: false,
  isOnline: false,
  isPaid: false,
  category: "meetup",
  suggestedTags: [],
  confidence: 0.75,
  reasoning: "",
};

describe("applyPendingDecision guards tags", () => {
  test("the UPDATE pins the tags the decision read", async () => {
    await applyPendingDecision(baseRow([]), verdict, {
      action: "hide",
      reason: "autopilot:lowconf-yes",
      hiddenReason: "llm-screened",
    });
    const q = dialect.sqlToQuery(captured!);
    expect(q.sql).toContain("to_jsonb(tags) IS NOT DISTINCT FROM $");
    /* The tags parameter is the JSON of what was read: [] here, so a row
       whose tags became ["blockchain"] no longer matches. */
    expect(q.params).toContain("[]");
    expect(q.params).not.toContain('["blockchain"]');
  });
  test("null tags are SQL NULL, not the JSON null", async () => {
    await applyPendingDecision(baseRow(null), verdict, { action: "hide", reason: "r", hiddenReason: "llm-screened" });
    const q = dialect.sqlToQuery(captured!);
    const i = q.sql.indexOf("to_jsonb(tags) IS NOT DISTINCT FROM $");
    const n = Number(/\$(\d+)/.exec(q.sql.slice(i))![1]);
    expect(q.params[n - 1]).toBeNull();
  });
  test("tagsJson", () => {
    expect(tagsJson(null)).toBeNull();
    expect(tagsJson(undefined)).toBeNull();
    expect(tagsJson([])).toBe("[]");
    expect(tagsJson(["ai", "blockchain"])).toBe('["ai","blockchain"]');
  });
});

describe("duplicate hides recheck their original (Astra round 3)", () => {
  const dup = { action: "hide", reason: "autopilot:dup", hiddenReason: "cross-post" } as const;
  const orig = [{ id: "00000000-0000-0000-0000-000000000009", title: "Rust Builders Night" }];
  test("the write locks and requires a still-live original", async () => {
    captured = null;
    await applyPendingDecision(baseRow([]), verdict, dup, orig);
    const q = dialect.sqlToQuery(captured!);
    expect(q.sql).toContain("keeper AS (");
    expect(q.sql).toContain("FOR SHARE OF k");
    expect(q.sql).toContain("AND EXISTS (SELECT 1 FROM keeper)");
    expect(q.sql).toContain("k.status = 'approved'");
    expect(q.params).toContain(JSON.stringify(orig));
  });
  test("a duplicate decision with no original never writes", async () => {
    captured = null;
    expect(await applyPendingDecision(baseRow([]), verdict, dup)).toBe(false);
    expect(captured).toBeNull();
  });
  test("other decisions carry no keeper clause", async () => {
    await applyPendingDecision(baseRow([]), verdict, { action: "hide", reason: "autopilot:lowconf-yes", hiddenReason: "llm-screened" });
    expect(dialect.sqlToQuery(captured!).sql).not.toContain("keeper");
  });
});

describe("pendingFacts", () => {
  const me = (title: string) => ({ ...(baseRow([]) as object), title }) as never;
  test("an approved or older same-link pending row with the same title is the original", async () => {
    queued = [[{ id: "e", title: "HackerX Utah", status: "approved" }], [{ n: 0 }]];
    expect((await pendingFacts(me("HackerX Utah"))).originals).toEqual([{ id: "e", title: "HackerX Utah" }]);
  });
  test("placeholder titles never duplicate", async () => {
    queued = [[{ id: "p", title: "TBD", status: "approved" }], [{ n: 0 }]];
    expect((await pendingFacts(me("TBD"))).duplicate).toBe(false);
  });
});

describe("applyQueueTwinHide (Astra round 6)", () => {
  const hide = baseRow([]);
  const keep = { ...(baseRow([]) as object), id: "00000000-0000-0000-0000-000000000009", externalId: "evt-1" } as never;
  test("every hide locks a live keeper, pins the hidden row and checks the gate", async () => {
    await applyQueueTwinHide(hide, keep, "listing");
    const q = dialect.sqlToQuery(captured!).sql;
    expect(q).toContain("FOR SHARE");
    expect(q).toContain("k.status IN ('pending', 'approved')");
    expect(q).toContain("status_locked = false");
    expect(q).toContain("source <> 'manual'");
    expect(q).toContain("llm_gate_enabled");
    expect(q).toContain("'autopilot:queue-dup'");
    expect(q).not.toContain("make_interval");
  });
  test("a stale-relist hide rechecks that the hidden row is still stale and the keeper still seen", async () => {
    await applyQueueTwinHide(hide, keep, "relist");
    const { sql: q, params } = dialect.sqlToQuery(captured!);
    expect(q).toContain("updated_at <= now() - make_interval(secs =>");
    expect(q).toContain("k.updated_at > now() - make_interval(secs =>");
    expect(params).toContain(2 * 24 * 60 * 60);
  });
});
