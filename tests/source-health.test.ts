import assert from "node:assert/strict";
import { test } from "node:test";
import { detectAlerts, type SourceRow } from "../src/lib/health";

function source(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: "silicon-slopes", adapter: "siliconSlopes", url: "https://www.siliconslopes.com/c/events",
    groupId: null, enabled: true, requiresReview: false,
    lastScrapedAt: new Date(), lastStatus: "ok: 29 items", lastError: null,
    authRotatedAt: new Date(Date.now() - 102 * 86400000), config: null,
    createdAt: new Date(Date.now() - 200 * 86400000), ...overrides,
  };
}

test("an old rotation date does not warn for the public Silicon Slopes feed", () => {
  assert.deepEqual(detectAlerts([source()]), []);
});

test("Silicon Slopes HTTP failures stay visible despite an old rotation date", () => {
  const alerts = detectAlerts([source({ lastStatus: "error", lastError: "Circle API 403 Forbidden" })]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, "source_error");
  assert.equal(alerts[0].level, "urgent");
  assert.match(alerts[0].body, /403/);
});

test("an empty public feed warns about missing events without diagnosing cookie expiry", () => {
  const alerts = detectAlerts([source({ lastStatus: "ok: 0 items" })]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, "source_error");
  assert.equal(alerts[0].level, "warn");
  assert.doesNotMatch(JSON.stringify(alerts), /cookie/i);
});

test("cookie age monitoring still applies to sources that use session auth", () => {
  const alerts = detectAlerts([source({ adapter: "privateFeed" })]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, "cookie_expiry");
});
