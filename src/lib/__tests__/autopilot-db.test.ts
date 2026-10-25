import { describe, expect, mock, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/* The guarded write must refuse a stale decision. These tests render the
   SQL the write sends (no database) and check the tag guard: a scrape that
   adds "blockchain" after classification must make the write a no-op, since
   the crypto hold would now send the row to a human (Astra round 2). */

let captured: SQL | null = null;
mock.module("@/lib/db", () => ({
  db: {
    execute: async (q: SQL) => {
      captured = q;
      return { rows: [] };
    },
  },
  events: {},
  sources: {},
  pendingSubmissions: {},
  reviewDecisions: {},
}));

const { applyPendingDecision, tagsJson } = await import("@/lib/autopilot-db");

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
