import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { promises as dns } from "node:dns";
import { siliconSlopesAdapter } from "../src/lib/scrapers/adapters/silicon-slopes";

const originalCookie = process.env.SILICON_SLOPES_SESSION_COOKIE;
afterEach(() => {
  mock.restoreAll();
  if (originalCookie === undefined) delete process.env.SILICON_SLOPES_SESSION_COOKIE;
  else process.env.SILICON_SLOPES_SESSION_COOKIE = originalCookie;
});

test("public Silicon Slopes events scrape without a session cookie", async () => {
  delete process.env.SILICON_SLOPES_SESSION_COOKIE;
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).has("cookie"), false);
    if (input.includes("/internal_api/events/community_events")) {
      return Response.json({
        page: 1, per_page: 10, count: 1, page_count: 1, has_next_page: false,
        records: [{
          id: 34313274, slug: "founder-talk", name: "Founder Talk", status: "published",
          event_setting_attributes: {
            starts_at: "2026-09-10T18:00:00.000Z", ends_at: "2026-09-10T19:00:00.000Z",
            location_type: "in_person",
            in_person_location: JSON.stringify({ formatted_address: "470 W 200 N, Salt Lake City, UT 84103" }),
          },
        }],
      });
    }
    assert.equal(input, "https://www.siliconslopes.com/c/events/founder-talk");
    return new Response('<meta property="og:description" content="A conversation with Utah founders.">');
  });
  const items = await siliconSlopesAdapter.scrape({ url: "https://www.siliconslopes.com/c/events", maxItems: 10 });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Founder Talk");
  assert.equal(items[0].startsAt.toISOString(), "2026-09-10T18:00:00.000Z");
  assert.equal(items[0].city, "Salt Lake City");
  assert.equal(items[0].description, "A conversation with Utah founders.");
});

test("a leftover cookie is not sent to the public API", async () => {
  process.env.SILICON_SLOPES_SESSION_COOKIE = "obsolete-test-cookie";
  mock.method(globalThis, "fetch", async (_input: string, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).has("cookie"), false);
    return Response.json({ count: 0, records: [] });
  });
  assert.deepEqual(await siliconSlopesAdapter.scrape({ url: "https://www.siliconslopes.com/c/events" }), []);
});

test("API errors remain failures without suggesting cookie rotation", async () => {
  delete process.env.SILICON_SLOPES_SESSION_COOKIE;
  mock.method(globalThis, "fetch", async () => new Response("Forbidden", { status: 403 }));
  await assert.rejects(siliconSlopesAdapter.scrape({ url: "https://www.siliconslopes.com/c/events" }), /Circle API 403/);
});

test("an unexpected API payload cannot silently look like an empty calendar", async () => {
  delete process.env.SILICON_SLOPES_SESSION_COOKIE;
  mock.method(globalThis, "fetch", async () => Response.json({ error: "sign_in_required" }));
  await assert.rejects(siliconSlopesAdapter.scrape({ url: "https://www.siliconslopes.com/c/events" }), /records/i);
});
