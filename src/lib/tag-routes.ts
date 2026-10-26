/* Where a tag's landing page lives, and the 308s that send old tag URLs
   there. Most tags live at /tag/<slug>; a few have a dedicated page
   (founders -> /startup-events). Imported by next.config.ts, so only
   relative imports here. Unit tested in tests/tag-routes.test.ts. */

import { canonicalTag, RETIRED_TAG_SEARCH, TAG_ALIASES } from "./auto-tag";
import { toSlug } from "./slugs";

export const STARTUP_EVENTS_PATH = "/startup-events";

/* Canonical tag -> its dedicated page, instead of /tag/<slug>. */
export const DEDICATED_TAG_PAGES: Readonly<Record<string, string>> = {
  founders: STARTUP_EVENTS_PATH,
};

/* Spellings that were never stored as tags but people (and search
   engines) guess: send them to the dedicated page too. */
const EXTRA_TAG_REDIRECTS: Readonly<Record<string, string>> = {
  startups: STARTUP_EVENTS_PATH,
};

/* The landing page for any stored tag spelling (aliases fold in). A
   retired tag has no page; its search is the closest thing. */
export function tagPath(tag: string): string {
  const key = tag.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(EXTRA_TAG_REDIRECTS, key)) return EXTRA_TAG_REDIRECTS[key];
  const canonical = canonicalTag(key);
  if (!canonical) {
    const q = RETIRED_TAG_SEARCH[key];
    return q ? `/?q=${encodeURIComponent(q)}` : "/";
  }
  return DEDICATED_TAG_PAGES[canonical] ?? `/tag/${toSlug(canonical)}`;
}

/* /tag/<slug> requests that must move elsewhere: old alias spellings,
   tags with a dedicated page, and the extra guessed spellings. Each
   source maps straight to its final page (no redirect chains). */
export function tagRedirects(): Array<{ source: string; destination: string; permanent: true }> {
  const keys = new Set<string>([
    ...Object.keys(TAG_ALIASES),
    ...Object.keys(DEDICATED_TAG_PAGES),
    ...Object.keys(EXTRA_TAG_REDIRECTS),
  ]);
  return [...keys].map((key) => ({
    source: `/tag/${key}`,
    destination: tagPath(key),
    permanent: true as const,
  }));
}

/* For the /tag/[tag] page: the path a slug must move to, or null when
   /tag/<slug> is its own page. Case-insensitive, so /tag/Founders and
   /tag/STARTUP move too (next.config's redirects match case exactly). */
export function tagSlugRedirect(slug: string): string | null {
  const key = decodeURIComponentSafe(slug).toLowerCase();
  const isAlias = Object.prototype.hasOwnProperty.call(TAG_ALIASES, key);
  const isExtra = Object.prototype.hasOwnProperty.call(EXTRA_TAG_REDIRECTS, key);
  const isDedicated = Object.prototype.hasOwnProperty.call(DEDICATED_TAG_PAGES, key);
  if (!isAlias && !isExtra && !isDedicated) return null;
  const dest = tagPath(key);
  return dest === `/tag/${slug}` ? null : dest;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
