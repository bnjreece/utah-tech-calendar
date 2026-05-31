/* Default site OG image - rendered for the homepage and used as the
   fallback for routes that don't define their own. Same editorial frame
   as the per-event image so a share thread of multiple links reads as
   one publication. */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Utah Tech Calendar - the comprehensive calendar of in-person Utah tech events";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F7F3EA";
const INK = "#1A1815";
const INK_SOFT = "#7A6F5F";
const TERRACOTTA = "#A55F3B";

export default async function HomeOgImage() {
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
          № 1 · updated daily · cottonwood heights, ut
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              alignItems: "baseline",
              fontSize: 128,
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: INK,
            }}
          >
            <span style={{ fontStyle: "normal" }}>Utah tech calendar</span>
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.35,
              fontStyle: "italic",
              color: INK_SOFT,
              maxWidth: 980,
            }}
          >
            A periodical of in-person tech meetups, conferences, founder mixers,
            and developer nights across Salt Lake City, Provo, Lehi, Ogden, and
            Silicon Slopes.
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
          <div>updated nightly</div>
          <div style={{ color: INK, letterSpacing: "0.24em" }}>utahtechcalendar.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
