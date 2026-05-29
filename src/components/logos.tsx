import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Three Reflection variants — v7.
   Same composition (mountain + horizon + reflection + ripples),
   refined in three directions: refined classic, two peaks, and
   striped shimmer reflection.
   ────────────────────────────────────────────────────────────── */

// A. Reflection Calm — single mountain with more breathing room
//    above (peak at y=10 instead of y=6), 5 ripples fading and
//    stepping inward. The most refined version of the current.
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

// B. Reflection Range — asymmetric two-peak Wasatch silhouette
//    above + the same silhouette reflected below. Range character
//    enters the reflection composition.
export function ReflectionRangeLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Two-peak mountain: left taller, right shorter, with a saddle between */}
      <path d="M 0 26 L 14 8 L 24 18 L 34 14 L 48 26 Z" />
      <rect x="0" y="26" width="48" height="0.75" />
      {/* Reflected: same shape flipped */}
      <path d="M 0 27 L 14 41 L 24 33 L 34 37 L 48 27 Z" opacity="0.32" />
      {/* Three ripples */}
      <rect x="4" y="31" width="40" height="0.4" opacity="0.5" />
      <rect x="8" y="35" width="32" height="0.4" opacity="0.45" />
      <rect x="14" y="39" width="20" height="0.4" opacity="0.4" />
    </svg>
  );
}

// C. Reflection Shimmer — single mountain above + reflection
//    broken into 4 trapezoidal stripes following the inverted
//    slope, fading as they descend. Water shimmer texture.
export function ReflectionShimmerLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 4 26 L 24 10 L 44 26 Z" />
      <rect x="0" y="26" width="48" height="0.75" />
      {/* Trapezoidal stripes inside the reflection's inverted triangle.
          Slope: 20/16 = 1.25 x-units per y-unit from the inverted peak. */}
      <polygon points="6,28 42,28 40,29.5 8,29.5" opacity="0.5" />
      <polygon points="12,31 36,31 34,32.5 14,32.5" opacity="0.4" />
      <polygon points="17,34 31,34 29,35.5 19,35.5" opacity="0.32" />
      <polygon points="21,37 27,37 25,38.5 23,38.5" opacity="0.26" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "reflection-calm",
    name: "Reflection Calm",
    category: "reflection · refined",
    description:
      "The current direction, polished. Mountain peak at y=10 (8 units of breathing room above the peak, was 6). Five ripple lines instead of three, stepping inward and fading as they recede. Most conservative iteration.",
    Component: ReflectionCalmLogo,
  },
  {
    id: "reflection-range",
    name: "Reflection Range",
    category: "reflection · range",
    description:
      "Asymmetric two-peak Wasatch silhouette above and reflected below. Saddle between the peaks. Adds range personality while staying inside the reflection composition. Three ripples.",
    Component: ReflectionRangeLogo,
  },
  {
    id: "reflection-shimmer",
    name: "Reflection Shimmer",
    category: "reflection · shimmer",
    description:
      "Mountain solid above; reflection broken into 4 trapezoidal stripes following the inverted slope, fading as they descend. Water shimmer texture — most 70s-poster of the three.",
    Component: ReflectionShimmerLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
