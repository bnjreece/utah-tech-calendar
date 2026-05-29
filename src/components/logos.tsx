import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Three Reflection variants — v8.
   Calm (fallback), Combo (Range silhouette + Calm ripples),
   Shimmer (rebuilt: hairlines instead of trapezoidal blocks).
   ────────────────────────────────────────────────────────────── */

// A. Reflection Calm — single mountain, breathing room above,
//    five ripples stepping inward and fading. Safest pick.
export function ReflectionCalmLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 4 26 L 24 10 L 44 26 Z" />
      <rect x="0" y="26" width="48" height="0.75" />
      <path d="M 4 27 L 24 41 L 44 27 Z" opacity="0.32" />
      <rect x="4" y="30" width="40" height="0.4" opacity="0.5" />
      <rect x="7" y="33" width="34" height="0.4" opacity="0.45" />
      <rect x="11" y="36" width="26" height="0.4" opacity="0.4" />
      <rect x="15" y="39" width="18" height="0.4" opacity="0.35" />
      <rect x="20" y="42" width="8" height="0.4" opacity="0.3" />
    </svg>
  );
}

// B. Reflection Combo — Range's asymmetric two-peak Wasatch
//    silhouette above + Calm's five stepping ripples below.
//    Best of both: more character above, more rhythm below.
export function ReflectionComboLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Two-peak silhouette: left taller, saddle, right shorter */}
      <path d="M 0 26 L 14 10 L 24 18 L 34 14 L 48 26 Z" />
      <rect x="0" y="26" width="48" height="0.75" />
      {/* Reflected two-peak silhouette */}
      <path d="M 0 27 L 14 41 L 24 33 L 34 37 L 48 27 Z" opacity="0.32" />
      {/* Calm's five stepping ripples, scaled to the wider Range base */}
      <rect x="0" y="30" width="48" height="0.4" opacity="0.5" />
      <rect x="4" y="33" width="40" height="0.4" opacity="0.45" />
      <rect x="8" y="36" width="32" height="0.4" opacity="0.4" />
      <rect x="14" y="39" width="20" height="0.4" opacity="0.35" />
      <rect x="20" y="42" width="8" height="0.4" opacity="0.3" />
    </svg>
  );
}

// C. Reflection Shimmer v2 — solid mountain above, but NO solid
//    reflection silhouette. Instead, 9 thin horizontal hairlines
//    of varying length form a virtual reflection — water surface
//    shimmering. The mountain "exists" in the water only through
//    the implied shape of the lines.
export function ReflectionShimmerLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 4 26 L 24 10 L 44 26 Z" />
      <rect x="0" y="26" width="48" height="0.75" />
      {/* 9 hairlines, each width = reflection's outline width at that y.
          Slope 20/14 = ~1.43 x-units per y-unit from the inverted peak.
          Opacities fade 0.55 → 0.2 with depth. */}
      <rect x="5.5"  y="28"   width="37" height="0.4" opacity="0.55" />
      <rect x="7.5"  y="29.5" width="33" height="0.4" opacity="0.5" />
      <rect x="9.5"  y="31"   width="29" height="0.4" opacity="0.45" />
      <rect x="11.5" y="32.5" width="25" height="0.4" opacity="0.4" />
      <rect x="14"   y="34"   width="20" height="0.4" opacity="0.36" />
      <rect x="16"   y="35.5" width="16" height="0.4" opacity="0.32" />
      <rect x="18"   y="37"   width="12" height="0.4" opacity="0.28" />
      <rect x="20"   y="38.5" width="8"  height="0.4" opacity="0.24" />
      <rect x="22.5" y="40"   width="3"  height="0.4" opacity="0.2" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "reflection-calm",
    name: "Reflection Calm",
    category: "reflection · refined",
    description:
      "Single mountain peak with breathing room above. Five ripples step inward and fade with depth. Forms a clean diamond at favicon size. The safest pick.",
    Component: ReflectionCalmLogo,
  },
  {
    id: "reflection-combo",
    name: "Reflection Combo",
    category: "reflection · best of both",
    description:
      "Range's asymmetric two-peak Wasatch silhouette above (left peak taller, saddle, right peak shorter) + Calm's five stepping ripples below. More character above, more rhythm in the water.",
    Component: ReflectionComboLogo,
  },
  {
    id: "reflection-shimmer",
    name: "Reflection Shimmer",
    category: "reflection · shimmer",
    description:
      "Rebuilt: trapezoidal blocks replaced with 9 thin hairlines, each width = the reflection's outline at that y. No solid reflection silhouette — the mountain's reflection exists only through the implied shape of the shimmering water lines. Most 70s-poster of the three.",
    Component: ReflectionShimmerLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
