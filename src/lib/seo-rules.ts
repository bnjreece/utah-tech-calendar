/* Pure SEO decisions shared by pages, the sitemap and JSON-LD: which pages
   get indexed, how titles read, and what Event structured data says. No DB
   access here so every rule is unit tested (tests/seo-rules.test.ts). */

import { canonicalizeTags } from "./auto-tag";
import { displayTitle, type DisplayTitleInput } from "./display";
import { getSpecialWeek, specialWeekTagsFor } from "./special-weeks";
import { getTagMeta } from "./tag-taxonomy";
import { absoluteUrl, SITE_NAME } from "./seo";
import { eventSlug } from "./slugs";

/* A hub page (city, tag, month) with fewer events than this renders for
   visitors but is noindex and stays out of the sitemap. The sitemap and the
   pages count the same way, so a page in the sitemap is never noindex. */
export const MIN_INDEXABLE_EVENTS = 3;

export function hubIsIndexable(eventCount: number): boolean {
  return eventCount >= MIN_INDEXABLE_EVENTS;
}

/* robots value for a thin page: keep it out of the index but let crawlers
   follow its event links. */
export const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/* RSS / iCal autodiscovery links. A page that sets `alternates` replaces
   the layout's whole object, so pages that want these spread them in. */
export const FEED_ALTERNATE_TYPES = {
  "application/rss+xml": [{ url: "/api/rss", title: `${SITE_NAME} RSS` }],
  "text/calendar": [{ url: "/api/ical", title: `${SITE_NAME} iCal` }],
};

/* ---- Titles ---------------------------------------------------------- */

/* The root layout appends this to every child page's title, so page titles
   never name the brand themselves. */
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;

/* Homepage <title>: search words first, 60 chars or fewer. */
export const HOME_TITLE = "Utah Tech Events Calendar: Startup, AI & Dev Meetups";

const BRAND_SUFFIX_RE = new RegExp(`\\s*[·|\\-–—:]\\s*${SITE_NAME}\\s*$`, "i");

/* Drops a trailing " · Utah Tech Calendar" (or " - ", " | ") so the layout
   template adds the brand exactly once. */
export function stripBrand(title: string): string {
  let t = title.trim();
  while (BRAND_SUFFIX_RE.test(t)) t = t.replace(BRAND_SUFFIX_RE, "").trim();
  return t;
}

/* What the template renders, for tests and length checks. */
export function renderTitle(pageTitle: string): string {
  return TITLE_TEMPLATE.replace("%s", stripBrand(pageTitle));
}

/* ---- Event indexability ---------------------------------------------- */

/* Placeholder titles: the whole title is TBD / TBA / "To be announced" /
   "Untitled" / "Event", optionally after "Speaker" or a "Group - " prefix
   (the topic isn't known yet, so the page has nothing to rank for). Matches
   on the same normalization as the autopilot's PLACEHOLDER_TITLE_RE
   (lowercase, non-alphanumerics to spaces). */
const PLACEHOLDER_CORE = "(?:speaker )?(?:tbd|tba|to be (?:announced|determined)|untitled(?: event)?|event|coming soon)";
const PLACEHOLDER_RE = new RegExp(`^${PLACEHOLDER_CORE}$`);
const PREFIXED_PLACEHOLDER_RE = /(?:\s[-–—|·]|:)\s*(?:speaker\s+)?(?:tbd|tba|to be (?:announced|determined))\s*$/i;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isPlaceholderTitle(title: string): boolean {
  const key = normalizeTitle(title);
  if (key === "") return true;
  if (PLACEHOLDER_RE.test(key)) return true;
  return PREFIXED_PLACEHOLDER_RE.test(title.trim());
}

export interface IndexableEventInput {
  status: string;
  title: string;
}

/* An event page is indexable only when it is approved and has a real
   title. Hidden, pending and rejected rows still render (old links keep
   working) but are noindex with no Event markup. */
export function isEventIndexable(e: IndexableEventInput): boolean {
  return e.status === "approved" && !isPlaceholderTitle(e.title);
}

/* ---- Event JSON-LD --------------------------------------------------- */

export interface EventJsonLdInput extends DisplayTitleInput {
  id: string;
  status: string;
  description: string | null;
  startsAt: Date | string;
  endsAt: Date | string | null;
  isOnline: boolean;
  isTentative: boolean;
  isPaid: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  imageUrl: string | null;
  group: { name: string; slug?: string | null } | null;
}

export function eventPath(e: { title: string; id: string }): string {
  return `/event/${eventSlug(e.title, e.id)}`;
}

/* Google's event results need a physical place with an address: skip the
   markup for online-only, penciled-in (no real date) and non-indexable
   events, and for events with neither a street address nor a city. */
export function shouldEmitEventJsonLd(e: EventJsonLdInput): boolean {
  if (!isEventIndexable(e)) return false;
  if (e.isOnline || e.isTentative) return false;
  return Boolean(e.address?.trim() || e.city?.trim());
}

function toNumber(v: string | number | null): number | null {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const clean = (s: string | null | undefined): string | undefined => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

export function buildEventJsonLd(e: EventJsonLdInput): Record<string, unknown> | null {
  if (!shouldEmitEventJsonLd(e)) return null;
  const path = eventPath(e);
  const url = absoluteUrl(path);
  const lat = toNumber(e.latitude);
  const lng = toNumber(e.longitude);
  const city = clean(e.city);

  const location: Record<string, unknown> = {
    "@type": "Place",
    name: clean(e.venueName) ?? city,
    address: {
      "@type": "PostalAddress",
      streetAddress: clean(e.address),
      addressLocality: city,
      addressRegion: clean(e.state) ?? "UT",
      postalCode: clean(e.postalCode),
      addressCountry: "US",
    },
  };
  if (lat !== null && lng !== null) {
    location.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
  }

  /* The source page (Meetup, Luma, the organizer's site) is where people
     RSVP, so it goes in sameAs, never in `url`. No offers block: we don't
     know price or availability, and Google says not to guess them. */
  const rsvp = clean(e.link);

  const description = clean(e.description)?.slice(0, 500);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    url,
    name: displayTitle(e).replace(/\s+/g, " ").trim(),
    description,
    startDate: new Date(e.startsAt).toISOString(),
    endDate: e.endsAt ? new Date(e.endsAt).toISOString() : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    image: [clean(e.imageUrl) ?? absoluteUrl(`${path}/opengraph-image`)],
    sameAs: rsvp,
    /* A real group only. Source names (Meetup, "recurrence:...", "html")
       are platforms or internal ids, not organizers, so they're omitted. */
    organizer: e.group?.name
      ? {
          "@type": "Organization",
          name: e.group.name,
          url: e.group.slug ? absoluteUrl(`/group/${e.group.slug}`) : undefined,
        }
      : undefined,
  };
}

/* ---- Month links ----------------------------------------------------- */

const MONTH_SLUGS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/* The /events/<month> page an event is listed on. Month pages bucket by
   UTC month (lib/period.ts parsePeriod), so this does too. */
export function periodSlugFor(d: Date): string {
  return `${MONTH_SLUGS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/* ---- Sitemap hub counts ---------------------------------------------- */

/* Upcoming in-person events per canonical tag, counted the way /tag/<tag>
   lists them: canonical spellings (old ones fold in), each event once per
   tag, plus special-week tags earned by title and date. */
export function countTagHubs(
  rows: ReadonlyArray<{ tags: readonly string[] | null; title: string; startsAt: Date }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const tags = new Set([...canonicalizeTags(r.tags), ...specialWeekTagsFor(r)]);
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/* Keys whose count clears the index threshold, in the map's order. */
export function indexableHubs(counts: ReadonlyMap<string, number>): string[] {
  return [...counts].filter(([, n]) => hubIsIndexable(n)).map(([k]) => k);
}

/* ---- Event page tag links -------------------------------------------- */

/* /tag/<slug> resolves for curated tags and special weeks always, and for
   any other tag only while an approved upcoming event carries it. So an
   approved upcoming event can link all its tags; others link only the
   always-on ones (no links to 404s). */
export function tagIsLinkable(
  tag: string,
  e: { status: string; startsAt: Date | string },
  now: Date = new Date(),
): boolean {
  if (getTagMeta(tag) || getSpecialWeek(tag)) return true;
  return e.status === "approved" && new Date(e.startsAt).getTime() >= now.getTime();
}

/* The site-wide card (app/opengraph-image.tsx). Next only attaches a
   file-based image to pages without their own `openGraph`, so pages that
   set openGraph and have no image route of their own list this one. */
export const DEFAULT_OG_IMAGES = [
  { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME },
];
