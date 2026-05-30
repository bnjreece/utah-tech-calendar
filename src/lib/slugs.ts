/* Slug helpers shared by city, tag, and event canonical URLs. Lower-cases,
   keeps alphanumerics and dashes, collapses runs of non-alphanumerics.
   The same input always produces the same slug so URL generation and
   route param lookup agree. */

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/* Event canonical URL uses a slug derived from the title plus the first
   8 chars of the UUID as a uniqueness suffix. Old /event/[uuid] URLs
   still resolve - the route page handles both shapes. */
export function eventSlug(title: string, id: string): string {
  const titleSlug = toSlug(title).slice(0, 60).replace(/-$/, "") || "event";
  return `${titleSlug}-${id.slice(0, 8)}`;
}

/* Recover the 8-char id prefix from a canonical event URL. Returns null
   if the input doesn't end with one, in which case the caller should
   try to interpret the input as a raw UUID. */
export function extractIdPrefix(slug: string): string | null {
  const m = slug.match(/-([a-f0-9]{8})$/i);
  return m ? m[1] : null;
}

/* UUID v4-ish detector - we don't need to be strict, just to distinguish
   a raw UUID parameter from a slug parameter so we can redirect old
   /event/[uuid] hits to the canonical slug URL. */
export function looksLikeUuid(input: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input);
}
