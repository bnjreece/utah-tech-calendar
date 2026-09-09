import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { promises as dns } from "node:dns";
import { eventbriteAdapter } from "../src/lib/scrapers/adapters/eventbrite";

afterEach(() => mock.restoreAll());

const url = "https://www.eventbrite.com/d/ut--provo/tech--events/";
const html = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Event", name: "Utah Developer Night", startDate: "2026-09-10T18:00:00-06:00",
  url: "https://www.eventbrite.com/e/utah-developer-night-123",
  location: { name: "Community Hall", address: { addressLocality: "Provo" } },
})}</script>`;

test("Eventbrite recovers when two transient server errors precede a successful response", async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  let requests = 0;
  mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    assert.equal(input, url);
    assert.equal(init?.redirect, "manual");
    requests++;
    if (requests <= 2) return new Response("Bad Gateway", { status: 502 });
    return new Response(html);
  });
  const items = await eventbriteAdapter.scrape({ url });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Utah Developer Night");
  assert.equal(items[0].startsAt.toISOString(), "2026-09-11T00:00:00.000Z");
  assert.equal(requests, 3);
});

test("persistent Eventbrite server failures remain errors after bounded retries", async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  let requests = 0;
  mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response("Service Unavailable", { status: 503 });
  });
  await assert.rejects(eventbriteAdapter.scrape({ url }), /HTTP 503/);
  assert.equal(requests, 3);
});

test("slow Eventbrite attempts share the original search time budget", async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  let elapsed = 0;
  const timeouts: number[] = [];
  mock.method(performance, "now", () => elapsed);
  mock.method(AbortSignal, "timeout", (ms: number) => {
    timeouts.push(ms);
    return new AbortController().signal;
  });
  mock.method(globalThis, "setTimeout", (callback: () => void, ms: number) => {
    elapsed += ms;
    queueMicrotask(callback);
  });
  mock.method(globalThis, "fetch", async () => {
    elapsed += timeouts.at(-1)!;
    throw new DOMException("The operation timed out", "TimeoutError");
  });
  await assert.rejects(eventbriteAdapter.scrape({ url }), /timed out/);
  assert.equal(timeouts.length, 2);
  assert.deepEqual(timeouts, [30000, 29000]);
  assert.equal(elapsed, 61000);
});
