import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { promises as dns } from "node:dns";
import { afterEach, mock, test } from "node:test";
import { parseIcs, parseIcsDate } from "../src/lib/scrapers/ics";
import { icsToItem, lumaAdapter } from "../src/lib/scrapers/adapters/luma";

/* Saved 2026-10-25 from the official Hard Tech Week calendar's feed
   (api.lu.ma/ics/get?entity=calendar&id=cal-Ewfl6zNchcUhoZM). */
const ICS = readFileSync(new URL("./fixtures/luma-hard-tech-week.ics", import.meta.url), "utf8");
const CAL_URL = "https://luma.com/47g-hardtechweek";

afterEach(() => mock.restoreAll());

test("parses every event in the Hard Tech Week feed", () => {
  const evs = parseIcs(ICS);
  assert.equal(evs.length, 55);
  assert.equal(new Set(evs.map((e) => e.uid)).size, 55);
  const party = evs.find((e) => e.uid === "evt-zVrciaV3YtD2HtB@events.lu.ma");
  assert.ok(party);
  assert.equal(party.summary, "Hard Tech Week Opening Party");
  assert.equal(party.start.toISOString(), "2026-10-27T00:00:00.000Z");
  assert.equal(party.end?.toISOString(), "2026-10-27T03:00:00.000Z");
  /* Folded lines are joined back together. */
  assert.equal(party.location, "Traeger Grills Headquarters, 533 S 400 W, Salt Lake City, UT 84101, USA");
  assert.equal(party.organizerName, "47G");
  assert.ok(Math.abs((party.latitude ?? 0) - 40.7577839) < 1e-6);
  assert.match(party.description ?? "", /^Get up-to-date information at: https:\/\/luma\.com\/z9g8nkkk\n/);
});

test("reads UTC, floating, and all-day ICS dates", () => {
  assert.equal(parseIcsDate("20261026T170000Z")?.toISOString(), "2026-10-26T17:00:00.000Z");
  /* Floating = Denver wall-clock: MDT (UTC-6) in October, MST (UTC-7) in December. */
  assert.equal(parseIcsDate("20261026T110000")?.toISOString(), "2026-10-26T17:00:00.000Z");
  assert.equal(parseIcsDate("20261215T110000")?.toISOString(), "2026-12-15T18:00:00.000Z");
  assert.equal(parseIcsDate("20261028")?.toISOString(), "2026-10-28T06:00:00.000Z");
  assert.equal(parseIcsDate("nope"), undefined);
});

test("a Luma event from the feed keeps its evt- id and lu.ma link", () => {
  const ev = parseIcs(ICS).find((e) => e.uid.startsWith("evt-zVrciaV3YtD2HtB"))!;
  const item = icsToItem(ev, CAL_URL)!;
  assert.equal(item.externalId, "evt-zVrciaV3YtD2HtB");
  assert.equal(item.source, "luma");
  assert.equal(item.link, "https://lu.ma/z9g8nkkk");
  assert.equal(item.city, "Salt Lake City");
  assert.equal(item.isOnline, false);
  assert.equal(item.description, "Hosted by 47G & Utah Tech Week.");
});

test("an address shown only to guests is not online; a pinless URL location is", () => {
  const evs = parseIcs(ICS);
  const hidden = icsToItem(evs.find((e) => e.uid.startsWith("evt-cg4SEJlB4CqdaVB"))!, CAL_URL)!;
  assert.equal(hidden.isOnline, false);
  assert.equal(hidden.venueName, undefined);
  const virtual = icsToItem(evs.find((e) => e.uid.startsWith("evt-x8ykHFeu5bd96eU"))!, CAL_URL)!;
  assert.equal(virtual.isOnline, true);
});

test("external listings get their calev- id, the external link, and a clean title", () => {
  const evs = parseIcs(ICS);
  const zg = icsToItem(evs.find((e) => e.uid.startsWith("calev-hoa1Ne9TobPGF7a"))!, CAL_URL)!;
  assert.equal(zg.externalId, "calev-hoa1Ne9TobPGF7a");
  assert.equal(zg.title, "Zero Gravity Summit Day 1");
  assert.equal(zg.link, "https://zerogravitysummit.com/");
  assert.equal(zg.isOnline, false);
  assert.equal(zg.description, "Hosted by 47G.");
  const external = evs.filter((e) => e.uid.startsWith("calev-")).map((e) => icsToItem(e, CAL_URL)!);
  assert.equal(external.length, 6);
  assert.equal(new Set(external.map((i) => i.externalId)).size, 6);
  for (const i of external) assert.match(i.link, /^https:\/\/(?!luma\.com|lu\.ma)/);
});

function nextDataPage(data: unknown): string {
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { initialData: data } },
  })}</script></html>`;
}

test("a calendar scrape lists every upcoming feed event and prefers page nodes", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-25T14:00:00Z") });
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const detailCalls: string[] = [];
  mock.method(globalThis, "fetch", async (input: string) => {
    const u = new URL(input);
    if (u.hostname === "luma.com") {
      return new Response(
        nextDataPage({
          kind: "calendar",
          data: {
            calendar: { api_id: "cal-Ewfl6zNchcUhoZM", name: "Hard Tech Week" },
            featured_items: [
              {
                api_id: "calev-x",
                event: {
                  api_id: "evt-zVrciaV3YtD2HtB",
                  name: "Hard Tech Week Opening Party",
                  start_at: "2026-10-27T00:00:00.000Z",
                  url: "z9g8nkkk",
                  cover_url: "https://images.lumacdn.com/cover.png",
                  location_type: "offline",
                  geo_address_info: { full_address: "Traeger Grills Headquarters, 533 S 400 W, Salt Lake City, UT 84101, USA" },
                },
              },
            ],
          },
        }),
      );
    }
    if (u.pathname === "/ics/get") {
      assert.equal(u.searchParams.get("id"), "cal-Ewfl6zNchcUhoZM");
      return new Response(ICS);
    }
    if (u.pathname === "/event/get") {
      const id = u.searchParams.get("event_api_id")!;
      detailCalls.push(id);
      if (id === "evt-lsByb9xOaoQDXLy") {
        return Response.json({
          event: {
            api_id: id,
            name: "Power and Intelligence: What's Next? Quantum!",
            start_at: "2026-10-26T17:00:00.000Z",
            url: "quantum-utah-hard-tech",
            cover_url: "https://images.lumacdn.com/q.png",
            geo_address_info: { full_address: "Alta Club, 100 E S Temple St, Salt Lake City, UT 84111, USA" },
          },
          description_mirror: { type: "doc", content: [{ type: "text", text: "Quantum talk." }] },
        });
      }
      return Response.json({ message: "rate limited" }, { status: 429 });
    }
    throw new Error(`unexpected fetch ${input}`);
  });

  const items = await lumaAdapter.scrape({ url: CAL_URL, maxItems: 100 });
  /* 55 in the feed, 2 host briefings already over. */
  assert.equal(items.length, 53);
  assert.equal(new Set(items.map((i) => i.externalId)).size, 53);
  /* Soonest first. */
  for (let i = 1; i < items.length; i++)
    assert.ok(items[i - 1].startsAt.getTime() <= items[i].startsAt.getTime());
  /* Page node wins for an event the page carried. */
  const party = items.find((i) => i.externalId === "evt-zVrciaV3YtD2HtB")!;
  assert.equal(party.imageUrl, "https://images.lumacdn.com/cover.png");
  /* A feed-only event is upgraded from its detail fetch. */
  const quantum = items.find((i) => i.externalId === "evt-lsByb9xOaoQDXLy")!;
  assert.equal(quantum.description, "Quantum talk.");
  assert.equal(quantum.imageUrl, "https://images.lumacdn.com/q.png");
  assert.equal(quantum.link, "https://lu.ma/quantum-utah-hard-tech");
  /* A failed detail fetch leaves the feed's own data. */
  const tour = items.find((i) => i.externalId === "evt-YYJtXAkn5XHlYbo")!;
  assert.equal(tour.title, "Albany Engineered Composites Tour");
  assert.equal(tour.link, "https://lu.ma/k9poepkf");
  /* External listings never hit the event endpoint. */
  assert.ok(detailCalls.every((id) => id.startsWith("evt-")));

  const capped = await lumaAdapter.scrape({ url: CAL_URL, maxItems: 10 });
  assert.equal(capped.length, 10);
  assert.equal(capped[0].externalId, "evt-lsByb9xOaoQDXLy");
});

test("without a readable feed the scrape falls back to the page's events", async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  mock.method(globalThis, "fetch", async (input: string) => {
    const u = new URL(input);
    if (u.hostname === "lu.ma") {
      return new Response(
        nextDataPage({
          kind: "calendar",
          data: {
            calendar: { api_id: "cal-abc" },
            featured_items: [
              { event: { api_id: "evt-1", name: "Meetup", start_at: "2030-01-01T01:00:00.000Z", url: "m1" } },
            ],
          },
        }),
      );
    }
    if (u.pathname === "/ics/get") return new Response("error", { status: 500 });
    return Response.json({ description_mirror: { type: "text", text: "Body." } });
  });
  const items = await lumaAdapter.scrape({ url: "https://lu.ma/somecal", maxItems: 30 });
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "evt-1");
  assert.equal(items[0].link, "https://lu.ma/m1");
  assert.equal(items[0].description, "Body.");
});
