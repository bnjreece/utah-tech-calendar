/* SEO constants - the one place we set the canonical origin and brand
   strings used by metadata, sitemap, robots, and JSON-LD. Swap the
   SITE_URL env var when DNS for utahtech.events settles permanently. */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://utahtech.events";

export const SITE_NAME = "Utah Tech Events";

export const SITE_DESCRIPTION =
  "The comprehensive calendar of in-person Utah tech events. Meetups, conferences, founder mixers, AI nights, hardware hacks, and design talks across Salt Lake City, Provo, Lehi, Ogden, and Silicon Slopes. Online events filtered by default.";

export const SITE_TAGLINE =
  "Meetups, conferences, founder mixers, and developer events across Salt Lake City, Provo, Lehi, Ogden, and Silicon Slopes.";

export const ORGANIZATION_NAME = "Utah Tech Events";

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
