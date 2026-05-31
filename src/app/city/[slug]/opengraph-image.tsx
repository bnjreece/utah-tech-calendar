/* Per-city OG image. Same editorial frame, big city name as the headline,
   event count in the eyebrow so a share link shows scale at a glance. */

import { ImageResponse } from "next/og";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { toSlug } from "@/lib/slugs";

export const runtime = "nodejs";
export const alt = "Tech events in Utah";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F7F3EA";
const INK = "#1A1815";
const INK_SOFT = "#7A6F5F";
const TERRACOTTA = "#A55F3B";

async function resolveCity(slug: string): Promise<{ city: string; count: number } | null> {
  const rows = await db.execute<{ city: string }>(sql`
    SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND trim(city) <> ''
  `);
  const list = (Array.isArray(rows) ? rows : rows.rows ?? []) as Array<{ city: string }>;
  const match = list.find((r) => toSlug(r.city) === slug);
  if (!match) return null;

  const [counted] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isOnline, false),
        eq(events.city, match.city),
        gte(events.startsAt, new Date()),
      ),
    );

  return { city: match.city, count: counted?.c ?? 0 };
}

export default async function CityOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveCity(slug);
  const city = resolved?.city ?? "Utah";
  const count = resolved?.count ?? 0;

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
            width: 14,
            background: TERRACOTTA,
          }}
        />

        <div
          style={{
            fontFamily: "Menlo, monospace",
            fontSize: 24,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: INK_SOFT,
          }}
        >
          Utah Tech Calendar · City Edition
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div
            style={{
              fontSize: 36,
              fontStyle: "italic",
              color: INK_SOFT,
              letterSpacing: "-0.01em",
            }}
          >
            Tech events in
          </div>
          <div
            style={{
              fontSize: city.length > 14 ? 108 : 144,
              fontStyle: "italic",
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: INK,
            }}
          >
            {city}
          </div>
        </div>

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
          <div>
            {count > 0
              ? `${count} upcoming ${count === 1 ? "event" : "events"}`
              : "schedule loading"}
          </div>
          <div style={{ color: INK, letterSpacing: "0.24em" }}>utahtechcalendar.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
