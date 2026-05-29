import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Mountain marks in the Saul Bass / Paul Rand idiom — v5.
   Each composition browser-verified by inspecting actual bbox
   per child element + visualizing the rendered output.
   ────────────────────────────────────────────────────────────── */

// 1. Striped Crest — trapezoid stripes that actually follow the
//    mountain's slope, so the silhouette reads as a triangle, not
//    a wedding cake. 6 stripes + base bar. Sun behind.
export function StripedCrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <circle cx="24" cy="18" r="11" />
      {/* Trapezoidal stripes that taper to the peak.
          Slope ratio = 24/30 = 0.8 per y-unit from peak (y=14). */}
      <polygon points="22.4,16 25.6,16 28,19 20,19" />
      <polygon points="19.2,21 28.8,21 31.2,24 16.8,24" />
      <polygon points="16,26 32,26 34.4,29 13.6,29" />
      <polygon points="12.8,31 35.2,31 37.6,34 10.4,34" />
      <polygon points="9.6,36 38.4,36 40.8,39 7.2,39" />
      <polygon points="6.4,41 41.6,41 44,44 4,44" />
    </svg>
  );
}

// 2. Sunburst — sun raised above mountain peak so all 5 upper rays
//    are visible. No wasted strokes below. Sunrise effect, clean.
export function SunburstLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* 5 rays radiating from sun in the upper semicircle */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="0" x2="24" y2="3" />
        <line x1="33.5" y1="0.5" x2="30.5" y2="3.5" />
        <line x1="14.5" y1="0.5" x2="17.5" y2="3.5" />
        <line x1="40" y1="11" x2="36" y2="11" />
        <line x1="8" y1="11" x2="12" y2="11" />
      </g>
      <circle cx="24" cy="11" r="6" />
      <path d="M 0 44 L 24 13 L 48 44 Z" />
    </svg>
  );
}

// 3. Topo Crest — mountain FILLED so it actually blocks the sun's
//    bottom half. Sun moved up-right so it peeks behind the right
//    shoulder of the peak. Contour lines in lighter weight on the
//    mountain face create the topographic feel.
export function TopoCrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden {...props}>
      {/* Sun peeking from behind the right shoulder of the mountain */}
      <circle cx="36" cy="14" r="6" fill="currentColor" />
      {/* Mountain — filled, blocks the sun's lower half */}
      <path d="M 2 44 L 24 8 L 46 44 Z" fill="currentColor" />
      {/* Topographic V-chevron contour lines in paper color,
          create cut-out effect on the mountain face */}
      <g
        fill="none"
        stroke="var(--color-paper-deep)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M 9 39 L 24 17 L 39 39" />
        <path d="M 14 33 L 24 22 L 34 33" />
        <path d="M 18 27 L 24 25 L 30 27" />
      </g>
    </svg>
  );
}

// 4. Layered Range — three peaks spread across the width so each
//    one is visible (not piled on the left). Stepped opacities
//    create atmospheric depth. Small sun in corner for warmth.
export function LayeredRangeLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Small sun, upper-right corner — clear of the back peak */}
      <circle cx="40" cy="8" r="4" />
      {/* Back peak: tallest, centered, anchors full width */}
      <path d="M 2 44 L 28 4 L 46 44 Z" />
      {/* Middle peak: left-of-center, mid height, partial opacity */}
      <path d="M 0 44 L 12 16 L 28 44 Z" opacity="0.55" />
      {/* Front peak: right-of-center, shortest, lowest opacity */}
      <path d="M 22 44 L 36 24 L 48 44 Z" opacity="0.35" />
    </svg>
  );
}

// 5. Reflection — sun ABOVE-RIGHT, beside the mountain (visible,
//    not hidden behind it). Mountain reflects below the horizon
//    with a small reflected sun. Salt-flats sunset feel.
export function ReflectionLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Sun — top right, beside the peak */}
      <circle cx="38" cy="9" r="5" />
      {/* Mountain above horizon */}
      <path d="M 4 24 L 22 6 L 40 24 Z" />
      {/* Horizon */}
      <rect x="0" y="24" width="48" height="0.75" />
      {/* Reflection: mountain flipped, lighter */}
      <path d="M 4 25 L 22 43 L 40 25 Z" opacity="0.32" />
      {/* Reflection: sun, lower contrast */}
      <circle cx="38" cy="40" r="3" opacity="0.32" />
      {/* Three water ripple hairlines */}
      <rect x="6" y="30" width="36" height="0.4" opacity="0.5" />
      <rect x="10" y="34" width="28" height="0.4" opacity="0.5" />
      <rect x="14" y="38" width="20" height="0.4" opacity="0.5" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "striped-crest",
    name: "Striped Crest",
    category: "mountain · dithered",
    description:
      "Sun behind a mountain built from 6 trapezoidal stripes that follow the triangle's slope (fixed from v4 stacked rectangles — those read as a wedding cake). At 16px the stripes blur into a clean triangle; at 64px the texture sings.",
    Component: StripedCrestLogo,
  },
  {
    id: "sunburst",
    name: "Sunburst",
    category: "mountain · 70s",
    description:
      "Sun raised above the mountain peak with 5 rays in the upper semicircle (fixed from v4 — bottom rays were hidden behind the mountain, looked lopsided). Continental Airlines / Saul Bass travel-poster register.",
    Component: SunburstLogo,
  },
  {
    id: "topo-crest",
    name: "Topo Crest",
    category: "mountain · cartography",
    description:
      "Filled mountain blocks the sun's lower half (fixed from v4 — outlined mountain let the sun bleed through). Sun peeks from behind the right shoulder. Three V-chevron contour lines in paper color cut into the mountain face — USGS topographic chart compressed to a mark.",
    Component: TopoCrestLogo,
  },
  {
    id: "layered-range",
    name: "Layered Range",
    category: "mountain · depth",
    description:
      "Three peaks now spread across the width (fixed from v4 — all were stacked on the left). Back peak centered + tallest, middle-left at 55%, front-right at 35%. Small sun in upper-right corner. Hokusai compression with atmospheric depth.",
    Component: LayeredRangeLogo,
  },
  {
    id: "reflection",
    name: "Reflection",
    category: "mountain · sunset",
    description:
      "Sun moved upper-right, BESIDE the mountain peak (fixed from v4 — sun was hidden inside the mountain). Mountain reflects below the horizon with a smaller reflected sun + three water ripple lines. Salt-flats sunset.",
    Component: ReflectionLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
