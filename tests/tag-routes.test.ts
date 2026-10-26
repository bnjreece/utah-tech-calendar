import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTUP_EVENTS_PATH, tagPath, tagRedirects, tagSlugRedirect } from "../src/lib/tag-routes";
import { countTagHubs, MIN_INDEXABLE_EVENTS, tagHubPaths } from "../src/lib/seo-rules";

const redirectMap = () => new Map(tagRedirects().map((r) => [r.source, r]));

test("founders and its spellings 308 straight to /startup-events", () => {
  const m = redirectMap();
  for (const src of ["/tag/founders", "/tag/startup", "/tag/founder", "/tag/startups"]) {
    const r = m.get(src);
    assert.ok(r, `${src} has a redirect`);
    assert.equal(r.destination, STARTUP_EVENTS_PATH);
    assert.equal(r.permanent, true);
  }
});

test("other aliases and retired tags keep their old destinations", () => {
  const m = redirectMap();
  assert.equal(m.get("/tag/healthtech")?.destination, "/tag/biotech");
  assert.equal(m.get("/tag/medtech")?.destination, "/tag/biotech");
  assert.equal(m.get("/tag/product-management")?.destination, "/?q=product%20management");
  assert.equal(m.has("/tag/ai"), false);
  assert.equal(m.has("/tag/biotech"), false);
});

test("no redirect points at another redirect source (no chains)", () => {
  const m = redirectMap();
  for (const r of m.values()) assert.equal(m.has(r.destination), false, `${r.source} -> ${r.destination}`);
});

test("tagPath: founders goes to the dedicated page, the rest to /tag", () => {
  assert.equal(tagPath("founders"), STARTUP_EVENTS_PATH);
  assert.equal(tagPath("Startup"), STARTUP_EVENTS_PATH);
  assert.equal(tagPath("ai"), "/tag/ai");
  assert.equal(tagPath("hard-tech"), "/tag/hard-tech");
  assert.equal(tagPath("medtech"), "/tag/biotech");
});

test("tag page fallback redirects any case of the moved slugs", () => {
  assert.equal(tagSlugRedirect("founders"), STARTUP_EVENTS_PATH);
  assert.equal(tagSlugRedirect("Founders"), STARTUP_EVENTS_PATH);
  assert.equal(tagSlugRedirect("STARTUP"), STARTUP_EVENTS_PATH);
  assert.equal(tagSlugRedirect("HealthTech"), "/tag/biotech");
  assert.equal(tagSlugRedirect("ai"), null);
  assert.equal(tagSlugRedirect("biotech"), null);
});

const row = (tags: string[]) => ({ tags, title: "Pitch night", startsAt: new Date("2026-11-04T16:00:00Z") });

test("sitemap lists /startup-events, never /tag/founders, at the same threshold", () => {
  const rows = [row(["founders"]), row(["startup"]), row(["founder", "ai"]), row(["ai"]), row(["ai"])];
  const paths = tagHubPaths(countTagHubs(rows));
  assert.ok(paths.includes(STARTUP_EVENTS_PATH));
  assert.ok(paths.includes("/tag/ai"));
  assert.equal(paths.some((p) => p === "/tag/founders" || p === "/tag/startup"), false);

  const thin = Array.from({ length: MIN_INDEXABLE_EVENTS - 1 }, () => row(["founders"]));
  assert.equal(tagHubPaths(countTagHubs(thin)).includes(STARTUP_EVENTS_PATH), false);
});
