import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEventJsonLd,
  countTagHubs,
  HOME_TITLE,
  hubIsIndexable,
  indexableHubs,
  isEventIndexable,
  isPlaceholderTitle,
  MIN_INDEXABLE_EVENTS,
  periodSlugFor,
  renderTitle,
  shouldEmitEventJsonLd,
  stripBrand,
  tagIsLinkable,
  type EventJsonLdInput,
} from "../src/lib/seo-rules";
import { TAG_TAXONOMY } from "../src/lib/tag-taxonomy";
import { SITE_NAME } from "../src/lib/seo";
import { eventsToRss } from "../src/lib/feeds/rss";
import { eventsToIcal } from "../src/lib/feeds/ical";
import type { EventWithGroup } from "../src/lib/queries";

const SITE = "https://utahtechcalendar.com";

function ev(over: Partial<EventJsonLdInput> = {}): EventJsonLdInput {
  return {
    id: "e62033b0-1111-4222-8333-444455556666",
    title: "CTO Breakfast Utah",
    link: "https://ctobreakfast.com/communities/utah/",
    source: "recurrence:cto-breakfast-utah",
    status: "approved",
    description: "  Monthly   breakfast for technical leaders. ",
    startsAt: new Date("2026-11-05T14:30:00Z"),
    endsAt: new Date("2026-11-05T16:00:00Z"),
    isOnline: false,
    isTentative: false,
    isPaid: false,
    venueName: "Kneaders",
    address: "123 Main St",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84101",
    latitude: "40.760800",
    longitude: "-111.891000",
    imageUrl: null,
    group: null,
    ...over,
  };
}

/* ---- titles ---- */

test("homepage title is searchable and fits in 60 chars", () => {
  assert.ok(HOME_TITLE.length <= 60, `${HOME_TITLE.length} chars`);
  assert.match(HOME_TITLE, /Utah Tech & Startup Events/);
  assert.equal(HOME_TITLE.split("Utah Tech Calendar").length - 1, 1);
  assert.doesNotMatch(HOME_TITLE, /[—–]/);
});

test("stripBrand removes a trailing brand once or repeated, any separator", () => {
  assert.equal(stripBrand("Utah AI Events · Utah Tech Calendar"), "Utah AI Events");
  assert.equal(stripBrand("Submit — Utah Tech Calendar"), "Submit");
  assert.equal(stripBrand("Subscribe - Utah Tech Calendar"), "Subscribe");
  assert.equal(stripBrand("X · Utah Tech Calendar · Utah Tech Calendar"), "X");
  assert.equal(stripBrand("Utah Tech Calendar"), "Utah Tech Calendar");
  assert.equal(renderTitle("Utah AI Events · Utah Tech Calendar"), `Utah AI Events · ${SITE_NAME}`);
});

test("curated tag titles never carry the brand (the layout adds it)", () => {
  for (const t of TAG_TAXONOMY) {
    assert.ok(!t.seoTitle.includes(SITE_NAME), t.tag);
    const full = renderTitle(t.seoTitle);
    assert.equal(full.split(SITE_NAME).length - 1, 1, full);
    assert.doesNotMatch(t.seoTitle, /—/);
  }
});

/* ---- indexability ---- */

test("placeholder titles", () => {
  for (const t of ["TBD", "tba", "To be announced", "To Be Determined", "Untitled", "Untitled Event", "Event", "Speaker TBD", "  ", "???", "Utah Laravel - TBD", "Utah Go: TBD"]) {
    assert.equal(isPlaceholderTitle(t), true, t);
  }
  for (const t of ["CTO Breakfast Utah", "Event Horizon: AI Night", "TBD Labs demo day", "Events Team Meetup", "UtahJS Monthly"]) {
    assert.equal(isPlaceholderTitle(t), false, t);
  }
});

test("only approved, real-titled events are indexable", () => {
  assert.equal(isEventIndexable({ status: "approved", title: "UtahJS Monthly" }), true);
  assert.equal(isEventIndexable({ status: "hidden", title: "UtahJS Monthly" }), false);
  assert.equal(isEventIndexable({ status: "pending", title: "UtahJS Monthly" }), false);
  assert.equal(isEventIndexable({ status: "approved", title: "TBD" }), false);
});

test("hub threshold", () => {
  assert.equal(MIN_INDEXABLE_EVENTS, 3);
  assert.equal(hubIsIndexable(2), false);
  assert.equal(hubIsIndexable(3), true);
});

/* ---- JSON-LD ---- */

test("event JSON-LD points at our page, not the source", () => {
  const d = buildEventJsonLd(ev())!;
  assert.equal(d.url, `${SITE}/event/cto-breakfast-utah-e62033b0`);
  assert.equal(d["@id"], `${SITE}/event/cto-breakfast-utah-e62033b0#event`);
  assert.equal(d.sameAs, "https://ctobreakfast.com/communities/utah/");
  /* Price and availability are unknown, so no offers or free claim. */
  assert.equal(d.offers, undefined);
  assert.equal(d.isAccessibleForFree, undefined);
  assert.equal(d.description, "Monthly breakfast for technical leaders.");
});

test("organizer is a real group or omitted, never a source id", () => {
  assert.equal(buildEventJsonLd(ev())!.organizer, undefined);
  assert.ok(!JSON.stringify(buildEventJsonLd(ev())).includes("recurrence:"));
  const withGroup = buildEventJsonLd(ev({ group: { name: "CTO Breakfast", slug: "cto-breakfast-utah" } }))!;
  assert.deepEqual(withGroup.organizer, {
    "@type": "Organization",
    name: "CTO Breakfast",
    url: `${SITE}/group/cto-breakfast-utah`,
  });
});

test("image falls back to the generated OG card", () => {
  assert.deepEqual(buildEventJsonLd(ev())!.image, [`${SITE}/event/cto-breakfast-utah-e62033b0/opengraph-image`]);
  assert.deepEqual(buildEventJsonLd(ev({ imageUrl: "https://img.example/x.png" }))!.image, ["https://img.example/x.png"]);
});

test("location has an address and geo; paid events claim no price either", () => {
  const d = buildEventJsonLd(ev({ isPaid: true }))!;
  const loc = d.location as Record<string, Record<string, unknown>>;
  assert.equal(loc.address.addressLocality, "Salt Lake City");
  assert.equal(loc.address.streetAddress, "123 Main St");
  assert.deepEqual(loc.geo, { "@type": "GeoCoordinates", latitude: 40.7608, longitude: -111.891 });
  assert.equal(d.offers, undefined);
  assert.equal(d.isAccessibleForFree, undefined);
});

test("no JSON-LD for online, tentative, addressless, hidden or placeholder events", () => {
  assert.equal(shouldEmitEventJsonLd(ev()), true);
  assert.equal(buildEventJsonLd(ev({ isOnline: true })), null);
  assert.equal(buildEventJsonLd(ev({ isTentative: true })), null);
  assert.equal(buildEventJsonLd(ev({ address: null, city: "  " })), null);
  assert.equal(buildEventJsonLd(ev({ status: "hidden" })), null);
  assert.equal(buildEventJsonLd(ev({ title: "TBD" })), null);
  /* A city alone is not a location: a street address is required. */
  assert.equal(buildEventJsonLd(ev({ address: null })), null);
  assert.equal(buildEventJsonLd(ev({ address: "  ", venueName: "Kiln" })), null);
  /* With an address but no venue, the place is named by its address. */
  const loc = buildEventJsonLd(ev({ venueName: null }))!.location as Record<string, unknown>;
  assert.equal(loc.name, "123 Main St");
});

/* ---- sitemap hubs ---- */

test("tag hubs fold old spellings, count each event once, and add special weeks", () => {
  const d = new Date("2026-11-15T18:00:00Z");
  const counts = countTagHubs([
    { tags: ["ai", "AI"], title: "AI night", startsAt: d },
    { tags: ["ai"], title: "AI lunch", startsAt: d },
    { tags: ["startup"], title: "Pitch night", startsAt: d },
    { tags: ["founders", "startup"], title: "Founder dinner", startsAt: d },
    { tags: null, title: "Zero Gravity Summit", startsAt: new Date("2026-10-28T18:00:00Z") },
  ]);
  assert.equal(counts.get("ai"), 2);
  assert.equal(counts.get("founders"), 2);
  assert.equal(counts.get("startup"), undefined);
  assert.equal(counts.get("hard-tech-week"), 1);
  assert.deepEqual(indexableHubs(new Map([["a", 3], ["b", 2], ["c", 9]])), ["a", "c"]);
});

test("period slug uses the UTC month like /events/<month>", () => {
  assert.equal(periodSlugFor(new Date("2026-10-31T23:30:00-06:00")), "november-2026");
  assert.equal(periodSlugFor(new Date("2026-10-15T12:00:00Z")), "october-2026");
});

test("event page tag links never point at a 404", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const upcoming = { status: "approved", startsAt: new Date("2026-11-01T00:00:00Z") };
  const past = { status: "approved", startsAt: new Date("2026-10-01T00:00:00Z") };
  assert.equal(tagIsLinkable("rust", upcoming, now), true);
  assert.equal(tagIsLinkable("rust", past, now), false);
  assert.equal(tagIsLinkable("rust", { ...upcoming, status: "hidden" }, now), false);
  assert.equal(tagIsLinkable("ai", past, now), true);
  assert.equal(tagIsLinkable("hard-tech-week", past, now), true);
});

/* ---- feeds ---- */

function feedEvent(): EventWithGroup {
  return {
    ...(ev() as unknown as EventWithGroup),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    tags: ["ai"],
    group: null,
    region: "salt-lake" as EventWithGroup["region"],
  };
}

test("RSS items link to our event page and keep the source as RSVP", () => {
  const xml = eventsToRss([feedEvent()], SITE);
  assert.match(xml, /<link>https:\/\/utahtechcalendar\.com\/event\/cto-breakfast-utah-e62033b0<\/link>/);
  assert.match(xml, /RSVP: https:\/\/ctobreakfast\.com\/communities\/utah\//);
});

test("iCal URL is our event page; UID unchanged; source kept as RSVP", () => {
  const ics = eventsToIcal([feedEvent()], "utahtechcalendar.com", SITE);
  assert.match(ics, /\r\nURL:https:\/\/utahtechcalendar\.com\/event\/cto-breakfast-utah-e62033b0\r\n/);
  assert.match(ics, /UID:e62033b0-1111-4222-8333-444455556666@utahtechcalendar\.com/);
  assert.match(ics, /RSVP: https:\/\/ctobreakfast\.com\/communities\/utah\//);
});
