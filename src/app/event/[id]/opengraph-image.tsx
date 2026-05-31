/* Per-event Open Graph image. Renders a 1200x630 editorial card at
   request time and Vercel caches the response, so social shares get a
   tailored preview without us hand-rolling images. */

import { ImageResponse } from "next/og";
import { sql } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { getEventById } from "@/lib/queries";
import { extractIdPrefix, looksLikeUuid } from "@/lib/slugs";

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

const SOURCE_COLORS: Record<string, string> = {
  meetup: SUNSET,
  luma: DUSK,
  eventbrite: TERRACOTTA,
  silicon_slopes: TERRACOTTA,
  forge_utah: SAGE,
  substack: SAGE,
  manual: SAGE,
};

const SOURCE_LABELS: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
  substack: "Substack",
  manual: "Community",
};

async function resolveEventId(idParam: string): Promise<string | null> {
  if (looksLikeUuid(idParam)) return idParam;
  const prefix = extractIdPrefix(idParam);
  if (!prefix) return null;
  const r = await db.execute<{ id: string }>(sql`
    SELECT id FROM events WHERE id::text ILIKE ${prefix + "%"} LIMIT 1
  `);
  const rows = (Array.isArray(r) ? r : r.rows ?? []) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export default async function EventOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const realId = await resolveEventId(idParam);
  const event = realId ? await getEventById(realId) : null;

  const title = event?.title ?? "Utah Tech Calendar";
  const start = event ? new Date(event.startsAt) : null;
  const dateString = start
    ? start.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const timeString = start
    ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
    : "";
  const placeParts = event
    ? [event.venueName, event.city].filter(Boolean).join(" · ")
    : "Utah";
  const sourceLabel = event ? SOURCE_LABELS[event.source] ?? event.source : "";
  const sourceColor = event ? SOURCE_COLORS[event.source] ?? INK_SOFT : INK_SOFT;
  const tags: string[] = [];
  if (event?.isConference) tags.push("· Conference");
  if (event?.isPaid) tags.push("· Paid");
  if (event?.isOnline) tags.push("· Online");
  const tagLine = tags.join("  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: PAPER,
          color: INK,
          padding: "70px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 12,
            background: sourceColor,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "Menlo, monospace",
            fontSize: 22,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex" }}>Utah Tech Calendar</div>
          <div style={{ display: "flex", color: sourceColor }}>
            via {sourceLabel.toLowerCase()}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontFamily: "Menlo, monospace",
              fontSize: 28,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: INK_SOFT,
            }}
          >
            <span>{dateString}</span>
            <span style={{ color: INK }}>{timeString}</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize:
                title.length > 140
                  ? 44
                  : title.length > 100
                    ? 52
                    : title.length > 70
                      ? 64
                      : title.length > 45
                        ? 76
                        : 88,
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: INK,
              overflow: "hidden",
              maxHeight: 360,
            }}
          >
            {title.length > 200 ? title.slice(0, 197) + "…" : title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 40,
            fontFamily: "Menlo, monospace",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
            <div style={{ display: "flex" }}>{placeParts}</div>
            <div style={{ display: "flex", color: sourceColor }}>{tagLine}</div>
          </div>
          <div style={{ display: "flex", color: INK, letterSpacing: "0.24em" }}>
            utahtechcalendar.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
