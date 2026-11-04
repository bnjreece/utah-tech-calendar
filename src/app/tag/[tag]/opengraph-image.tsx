/* Per-tag Open Graph image. Renders a 1200x630 editorial card at
   request time and Vercel caches the response, so /tag/<vertical>
   shares (Slack, Twitter, LinkedIn) get a tailored preview pulling
   the curated display name + intro from the taxonomy registry plus
   the live upcoming-event count.

   Modeled after the per-event OG renderer but with the editorial
   intro replacing event-specific details. Uses the same palette so
   the share cards stay visually consistent across surfaces. */

import { ImageResponse } from "next/og";
import { fetchTagEvents } from "@/lib/tag-events";
import { findUpcomingTagBySlug } from "@/lib/queries";
import { getAllCanonicalTags, getTagMeta, tagDisplayName, type TagMeta } from "@/lib/tag-taxonomy";
import { toSlug } from "@/lib/slugs";
import { getSpecialWeek } from "@/lib/special-weeks";
import { canonicalTag } from "@/lib/auto-tag";

export const runtime = "nodejs";
export const alt = "Utah Tech Calendar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/* Cache the rendered card. Twitter/LinkedIn/Slack hit this URL once
   per share preview and refresh on their own cadence. The empty
   generateStaticParams makes this real on-demand ISR; the count comes
   from the shared cached dataset, never a database query. */
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

const PAPER = "#F7F3EA";
const INK = "#1A1815";
const INK_SOFT = "#7A6F5F";
const TERRACOTTA = "#A55F3B";
const SUNSET = "#D4865C";
const SAGE = "#8B9A7A";
const DUSK = "#6B7A8E";

/* Pick an accent color for the vertical so the social card has some
   stratum identity. Falls back to terracotta for unmapped tags. */
const TAG_ACCENT: Record<string, string> = {
  ai: TERRACOTTA,
  fintech: DUSK,
  biotech: SAGE,
  edtech: SUNSET,
  aerospace: TERRACOTTA,
  "hard-tech": TERRACOTTA,
  cybersecurity: SUNSET,
  gamedev: DUSK,
  founders: SUNSET,
};

/* Only tags the site knows get their name on the card: curated or
   aliased tags, special weeks, and tags on upcoming events (the same
   lookup the tag page uses). Any other slug gets the generic card, so a
   made-up URL cannot put arbitrary text on a site-branded image. */
async function resolveTag(slug: string): Promise<{ tag: string; meta: TagMeta | null } | null> {
  for (const t of getAllCanonicalTags()) {
    if (toSlug(t.tag) === slug) return { tag: t.tag, meta: t };
  }
  /* An old spelling (/tag/startup) still gets its vertical's card. */
  const canon = canonicalTag(slug);
  const curated = canon ? getTagMeta(canon) : null;
  if (curated) return { tag: curated.tag, meta: curated };
  if (getSpecialWeek(slug)) return { tag: slug, meta: null };
  const found = await findUpcomingTagBySlug(slug).catch(() => null);
  if (found) return { tag: found, meta: getTagMeta(found) };
  return null;
}

export default async function TagOgImage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: slug } = await params;
  const resolved = await resolveTag(slug);
  const meta = resolved?.meta ?? null;
  const display = resolved ? (meta?.display ?? tagDisplayName(resolved.tag)) : "Tech";
  const intro =
    meta?.intro ??
    `Every upcoming in-person Utah ${display} event we can find. Curated, tagged, scannable.`;
  const accent = (resolved && TAG_ACCENT[slug]) || TERRACOTTA;
  const pathLabel = resolved ? `/tag/${slug}` : "/tag";
  /* The same count the tag page lists. A curated vertical renders even
     on a dry week, since the tag landing page renders editorially in
     that case too. */
  const count = resolved
    ? await fetchTagEvents(resolved.tag)
        .then((evts) => evts.length)
        .catch(() => 0)
    : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top eyebrow row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "IBM Plex Mono, ui-monospace, monospace",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: INK_SOFT,
          }}
        >
          <span>Utah Tech Calendar</span>
          <span>{pathLabel}</span>
        </div>

        {/* Centerpiece: vertical name in big italic */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: accent,
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            {count > 0 ? `${count} upcoming` : "Editorial vertical"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 124,
              fontStyle: "italic",
              lineHeight: 1,
              letterSpacing: -2,
              color: INK,
              maxWidth: 1040,
            }}
          >
            Utah {display}.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 32,
              fontSize: 30,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxWidth: 920,
            }}
          >
            {intro.length > 200 ? intro.slice(0, 197) + "…" : intro}
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${INK}`,
            paddingTop: 22,
            fontFamily: "IBM Plex Mono, ui-monospace, monospace",
            fontSize: 18,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: INK_SOFT,
          }}
        >
          <span>utahtechcalendar.com</span>
          <span style={{ color: accent }}>discover. subscribe. share.</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
