/* Render-time presentation helpers. Kept separate from queries/storage
   so URLs (which use event.title for the slug) stay stable while the
   visible title can be prettified. */

import type { EventWithGroup } from "./queries";

/* Detect Meetup-style placeholder titles. Two distinct shapes:
   - Bare placeholders ("TBD", "Speaker tbd") - need a group/source
     prefix to be useful.
   - Prefixed placeholders ("Utah Laravel - TBD") - already self-
     describing; we just normalize " - TBD" to " · TBD" so the chip
     separator matches the rest of the editorial typography. */
const BARE_TBD_RE = /^(?:speaker\s+)?tbd$/i;
const PREFIXED_TBD_RE = /^(.+?)\s-\s*tbd\s*$/i;

function meetupGroupSlugFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const m = link.match(/meetup\.com\/([^/]+)/i);
  return m ? m[1] : null;
}

function prettifyMeetupSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* Returns the user-facing title. For TBD-pattern Meetup events, falls
   back to the linked group name (or, failing that, the meetup-group
   slug parsed from the link) so listings read "Utah Go · TBD" instead
   of a bare "TBD". Non-TBD titles return verbatim. */
export function displayTitle(
  event: Pick<EventWithGroup, "title" | "link" | "group" | "source">,
): string {
  const trimmed = event.title.trim();

  /* Prefixed flavor like "Utah Laravel - TBD" - the stored prefix is
     more accurate than anything we could derive (the meetup slug is
     `utahlaravel` and would prettify worse than the human-typed
     prefix). Just normalize the separator to match editorial style. */
  const prefixedMatch = trimmed.match(PREFIXED_TBD_RE);
  if (prefixedMatch && prefixedMatch[1]) {
    return `${prefixedMatch[1].trim()} · TBD`;
  }

  if (!BARE_TBD_RE.test(trimmed)) return event.title;

  /* Bare TBD - derive a prefix from the linked group, or from the
     meetup URL slug if no group is seeded. */
  if (event.group?.name) return `${event.group.name} · TBD`;
  if (event.source === "meetup") {
    const slug = meetupGroupSlugFromLink(event.link);
    if (slug) return `${prettifyMeetupSlug(slug)} · TBD`;
  }
  return event.title;
}
