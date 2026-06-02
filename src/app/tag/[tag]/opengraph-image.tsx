/* Per-tag Open Graph image. Renders a 1200x630 editorial card at
   request time and Vercel caches the response, so /tag/<vertical>
   shares (Slack, Twitter, LinkedIn) get a tailored preview pulling
   the curated display name + intro from the taxonomy registry plus
   the live upcoming-event count.

   Modeled after the per-event OG renderer but with the editorial
   intro replacing event-specific details. Uses the same palette so
   the share cards stay visually consistent across surfaces. */

import { ImageResponse } from "next/og";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { getTagMeta } from "@/lib/tag-taxonomy";
import { toSlug } from "@/lib/slugs";

export const runtime = "nodejs";
export const alt = "Utah Tech Calendar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
  healthtech: SAGE,
  biotech: SAGE,
  edtech: SUNSET,
  aerospace: TERRACOTTA,
  cybersecurity: SUNSET,
  gamedev: DUSK,
  founders: SUNSET,
};

async function countUpcoming(tag: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        gte(events.startsAt, new Date()),
        sql`lower(${tag}) = ANY(SELECT lower(t) FROM unnest(${events.tags}) AS t)`,
      ),
    );
  return rows[0]?.c ?? 0;
}

export default async function TagOgImage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: slug } = await params;
  /* Resolve to the canonical tag string via the taxonomy first; if
     it's not curated, fall back to the slug itself capitalized. */
  const meta = getTagMeta(slug);
  const display = meta?.display ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const intro =
    meta?.intro ??
    `Every upcoming in-person Utah ${display} event we can find. Curated, tagged, scannable.`;
  const accent = TAG_ACCENT[slug] ?? TERRACOTTA;
  const lookupTag = meta?.tag ?? slug;
  const count = await countUpcoming(lookupTag).catch(() => 0);
  /* Slug round-trip check - render the OG even on a "no events yet"
     dry-week vertical, since the tag landing page renders editorially
     in that case too. */
  void toSlug(lookupTag);

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
          <span>/tag/{slug}</span>
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
