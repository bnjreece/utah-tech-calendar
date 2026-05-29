import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Five mountain marks in the Saul Bass / Paul Rand idiom.
   Each composition layers primitives WITH a 70s/80s textural
   vocabulary — stripes, sunbursts, contour lines, layered
   silhouettes, reflection — so it reads as a logo, not an icon.
   All currentColor; no masks (portable across themes).
   ────────────────────────────────────────────────────────────── */

// 1. Striped Crest — sun + mountain rendered as stacked horizontal
//    bars (the IBM / AT&T striped sphere move). Pixel-art-adjacent.
//    Dithered feel: at 16px the stripes blur into a triangle; at
//    64px the texture sings.
export function StripedCrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <circle cx="24" cy="18" r="12" />
      {/* Mountain as 7 horizontal bars stacked, widening toward base */}
      <rect x="22" y="13" width="4" height="2.5" />
      <rect x="19" y="17.5" width="10" height="2.5" />
      <rect x="16" y="22" width="16" height="2.5" />
      <rect x="13" y="26.5" width="22" height="2.5" />
      <rect x="10" y="31" width="28" height="2.5" />
      <rect x="6" y="35.5" width="36" height="2.5" />
      <rect x="2" y="40" width="44" height="2.5" />
      <rect x="0" y="44.5" width="48" height="2" />
    </svg>
  );
}

// 2. Sunburst — sun with 8 radial rays + mountain triangle in front.
//    Continental Airlines / Saul Bass / 70s travel-poster energy.
export function SunburstLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* 8 sun rays radiating from (24,18) */}
      <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="24" y1="0" x2="24" y2="4" />
        <line x1="24" y1="32" x2="24" y2="36" />
        <line x1="0" y1="18" x2="4" y2="18" />
        <line x1="44" y1="18" x2="48" y2="18" />
        <line x1="6.5" y1="0.5" x2="9.5" y2="3.5" />
        <line x1="41.5" y1="0.5" x2="38.5" y2="3.5" />
        <line x1="6.5" y1="35.5" x2="9.5" y2="32.5" />
        <line x1="41.5" y1="35.5" x2="38.5" y2="32.5" />
      </g>
      <circle cx="24" cy="18" r="9" />
      <path d="M 0 44 L 24 14 L 48 44 Z" />
    </svg>
  );
}

// 3. Topo Crest — solid sun behind an OUTLINED mountain with internal
//    contour lines. USGS topographic chart compressed to a mark.
export function TopoCrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <circle cx="24" cy="18" r="9" />
      <g fill="none" stroke="currentColor" strokeLinejoin="round">
        {/* Outer mountain outline */}
        <path d="M 4 44 L 24 12 L 44 44 Z" strokeWidth="2.5" />
        {/* Inner contour lines following the slope */}
        <path d="M 10 38 L 24 18 L 38 38" strokeWidth="1.5" />
        <path d="M 14 33 L 24 22 L 34 33" strokeWidth="1.5" />
        <path d="M 18 28 L 24 26 L 30 28" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// 4. Range — three overlapping mountain silhouettes with stepped
//    opacities. Hokusai's 36 Views compressed into a single mark.
//    Reads as depth without using color.
export function LayeredRangeLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Sun: smaller, positioned high */}
      <circle cx="24" cy="12" r="8" />
      {/* Back peak: tallest, full opacity */}
      <path d="M 0 44 L 28 6 L 48 44 Z" />
      {/* Middle peak: shorter, 65% opacity */}
      <path d="M 0 44 L 14 22 L 32 44 Z" opacity="0.6" />
      {/* Front peak: shortest, 40% opacity */}
      <path d="M 0 44 L 6 30 L 22 44 Z" opacity="0.35" />
    </svg>
  );
}

// 5. Reflection — mountain + horizon + reflection below.
//    Bonneville salt flats / mirrored sunset / 70s landscape poster.
export function ReflectionLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Sun: full disc, sits on the horizon */}
      <circle cx="24" cy="22" r="6" />
      {/* Mountain above horizon */}
      <path d="M 4 24 L 24 6 L 44 24 Z" />
      {/* Horizon hairline */}
      <rect x="0" y="24" width="48" height="0.75" />
      {/* Reflection of mountain below horizon, partial opacity */}
      <path d="M 4 25 L 24 43 L 44 25 Z" opacity="0.3" />
      {/* Water texture: three horizontal lines */}
      <rect x="4" y="30" width="40" height="0.5" opacity="0.4" />
      <rect x="8" y="34" width="32" height="0.5" opacity="0.4" />
      <rect x="12" y="38" width="24" height="0.5" opacity="0.4" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "striped-crest",
    name: "Striped Crest",
    category: "mountain · dithered",
    description:
      "Sun behind a mountain rendered as 8 stacked horizontal bars (the IBM / AT&T striped-sphere move). At 16px the stripes blur into a single triangle; at 64px the texture sings.",
    Component: StripedCrestLogo,
  },
  {
    id: "sunburst",
    name: "Sunburst",
    category: "mountain · 70s",
    description:
      "Sun with 8 radial rays + mountain triangle in front. Continental Airlines / Saul Bass / 70s travel-poster energy. The rays do most of the storytelling.",
    Component: SunburstLogo,
  },
  {
    id: "topo-crest",
    name: "Topo Crest",
    category: "mountain · cartography",
    description:
      "Solid sun behind an outlined mountain with three internal contour lines following the slope. A USGS topographic chart compressed to a mark.",
    Component: TopoCrestLogo,
  },
  {
    id: "layered-range",
    name: "Layered Range",
    category: "mountain · depth",
    description:
      "Three overlapping mountain silhouettes at stepped opacities. Sun smaller and higher. Reads as atmospheric depth without color — Hokusai's 36 Views compressed to a single mark.",
    Component: LayeredRangeLogo,
  },
  {
    id: "reflection",
    name: "Reflection",
    category: "mountain · sunset",
    description:
      "Mountain + sun above a horizon with the mountain's reflection below + water-texture lines. Bonneville salt flats / mirrored sunset / 70s landscape poster.",
    Component: ReflectionLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
