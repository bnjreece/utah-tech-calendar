import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Final 3 mountain marks — v6.
   Striped Crest + Sunburst dropped. Each remaining mark
   browser-verified by inspecting actual rendered child bboxes.
   ────────────────────────────────────────────────────────────── */

// 1. Topo Crest — sun positioned to PEEK ABOVE the mountain peak
//    (not floating beside it). Mountain bites into the bottom of
//    the sun, sun's top half emerges. Three contour-line chevrons
//    stroked in paper color cut into the mountain face.
export function TopoCrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden {...props}>
      {/* Sun centered at the peak. Mountain will bite into its bottom. */}
      <circle cx="24" cy="6" r="6" fill="currentColor" />
      {/* Mountain — filled, taller so its peak intrudes into the sun */}
      <path d="M 2 44 L 24 8 L 46 44 Z" fill="currentColor" />
      {/* Topographic V-chevron contour lines as cut-outs on the
          mountain face. Paper-color stroke. */}
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

// 2. Layered Range — three peaks repositioned so each visibly
//    extends above the one behind it. Pure landscape, no sun.
//    Stepped opacities create atmospheric depth.
export function LayeredRangeLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Back peak: tallest, centered, anchors most of the width */}
      <path d="M 2 44 L 24 6 L 46 44 Z" />
      {/* Middle peak: apex left of back-peak's left slope so it
          peeks above. Mid opacity. */}
      <path d="M 0 44 L 10 16 L 26 44 Z" opacity="0.55" />
      {/* Front peak: apex right of back-peak's right slope so it
          peeks above on the right. Lower opacity. */}
      <path d="M 22 44 L 38 18 L 48 44 Z" opacity="0.35" />
    </svg>
  );
}

// 3. Reflection — mountain + horizon + reflection + water ripples.
//    No sun (both removed per user). Salt-flats minimalism.
export function ReflectionLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Mountain above horizon */}
      <path d="M 4 24 L 24 6 L 44 24 Z" />
      {/* Horizon hairline */}
      <rect x="0" y="24" width="48" height="0.75" />
      {/* Reflection: mountain flipped below */}
      <path d="M 4 25 L 24 43 L 44 25 Z" opacity="0.32" />
      {/* Three water ripple hairlines, getting shorter */}
      <rect x="6" y="30" width="36" height="0.4" opacity="0.5" />
      <rect x="10" y="34" width="28" height="0.4" opacity="0.5" />
      <rect x="14" y="38" width="20" height="0.4" opacity="0.5" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "topo-crest",
    name: "Topo Crest",
    category: "mountain · cartography",
    description:
      "Sun now PEEKS ABOVE the mountain peak (was floating beside it). Mountain bites into the bottom of the sun where they intersect. Three V-chevron contour lines stroked in paper-color cut into the mountain face — USGS topographic chart compressed.",
    Component: TopoCrestLogo,
  },
  {
    id: "layered-range",
    name: "Layered Range",
    category: "mountain · depth",
    description:
      "Sun removed. Three peaks now visibly distinct: back-center (tallest, full opacity), middle-left peeks above the back's left slope (55%), front-right peeks above the back's right slope (35%). Pure atmospheric depth via opacity stacking — Hokusai compression.",
    Component: LayeredRangeLogo,
  },
  {
    id: "reflection",
    name: "Reflection",
    category: "mountain · sunset",
    description:
      "Both suns removed. Mountain + horizon + reflected mountain + three water ripple hairlines, getting shorter as they recede. Salt-flats minimalism.",
    Component: ReflectionLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
