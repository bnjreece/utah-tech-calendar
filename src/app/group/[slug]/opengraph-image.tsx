import { ImageResponse } from "next/og";
import { getGroupBySlug, getUpcomingEventsForGroup } from "@/lib/queries";

export const runtime = "nodejs";
export const alt = "Utah Tech Events - Group";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F7F3EA";
const INK = "#1A1815";
const INK_SOFT = "#7A6F5F";
const TERRACOTTA = "#A55F3B";

export default async function GroupOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  const name = group?.name ?? "Utah tech group";
  const count = group ? (await getUpcomingEventsForGroup(group.id)).length : 0;

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
            background: TERRACOTTA,
            display: "flex",
          }}
        />

        <div
          style={{
            fontFamily: "Menlo, monospace",
            fontSize: 24,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: INK_SOFT,
            display: "flex",
          }}
        >
          Utah Tech Events · Group
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontSize: 36,
              color: INK_SOFT,
              letterSpacing: "-0.01em",
              display: "flex",
            }}
          >
            Upcoming events from
          </div>
          <div
            style={{
              fontSize: name.length > 26 ? 84 : name.length > 18 ? 108 : 132,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: INK,
              display: "flex",
              maxWidth: 1040,
            }}
          >
            {name}
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
          <div style={{ display: "flex" }}>
            {count > 0
              ? `${count} upcoming ${count === 1 ? "event" : "events"}`
              : "schedule loading"}
          </div>
          <div style={{ color: INK, letterSpacing: "0.24em", display: "flex" }}>utahtech.events</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
