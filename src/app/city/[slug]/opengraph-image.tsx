/* Per-city OG image. Same editorial frame, big city name as the headline,
   event count in the eyebrow so a share link shows scale at a glance. */

import { ImageResponse } from "next/og";
import { findCityBySlug, getUpcomingCityEvents } from "@/lib/queries";

export const runtime = "nodejs";
export const alt = "Tech events in Utah";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/* On-demand ISR from the shared cached dataset; no database query. */
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

const PAPER = "#F7F3EA";
const INK = "#1A1815";
const INK_SOFT = "#7A6F5F";
const TERRACOTTA = "#A55F3B";

async function resolveCity(slug: string): Promise<{ city: string; count: number } | null> {
  const city = await findCityBySlug(slug);
  if (!city) return null;
  return { city, count: (await getUpcomingCityEvents(city)).length };
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
