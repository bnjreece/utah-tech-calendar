import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   Five mountain variants. Saul Bass discipline:
   each is a single composition of geometric primitives,
   distinct from the others, scales clean from 16px to 192px.
   ────────────────────────────────────────────────────────────── */

// 1. Crest — sun rising behind a mountain triangle.
//    Two primitives overlapping create depth. The warmth move.
export function CrestLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <circle cx="24" cy="18" r="12" />
      <path d="M 0 44 L 24 14 L 48 44 Z" />
    </svg>
  );
}

// 2. Range — two overlapping triangle peaks.
//    Back peak taller, front peak shifted. Reads as a range, not a singular mountain.
export function RangeLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Back peak: tallest, anchors right */}
      <path d="M 8 44 L 28 4 L 48 44 Z" />
      {/* Front peak: shorter, shifted left */}
      <path d="M 0 44 L 14 18 L 28 44 Z" />
    </svg>
  );
}

// 3. Notch — single mountain with a Fuji-style V-notch at the summit.
//    The notch is the refinement; everything else is silence.
export function NotchLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 4 44 L 22 8 L 24 14 L 26 8 L 44 44 Z" />
    </svg>
  );
}

// 4. Peak — single bold isoceles triangle. The most minimal mountain.
//    Nothing earns its keep here that doesn't have to be there.
export function PeakLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 4 44 L 24 6 L 44 44 Z" />
    </svg>
  );
}

// 5. Crest Outline — line-art version of #1.
//    Lighter visual weight; same composition. Works when the ink mark
//    would be too heavy (small headers, watermarks, footers).
export function CrestOutlineLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="24" cy="18" r="11" />
      <path d="M 2 43 L 24 15 L 46 43 Z" />
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "crest",
    name: "Crest",
    category: "mountain",
    description:
      "Sun rising behind a single mountain triangle. Two primitives overlapping create depth without complexity. The warmth move — references the original strata identity through the sun. The composition I'd default to for the favicon.",
    Component: CrestLogo,
  },
  {
    id: "range",
    name: "Range",
    category: "mountain",
    description:
      "Two overlapping triangle peaks. Back peak taller, front peak shifted left. Reads as a range, not a singular mountain. More Wasatch-specific than the lone Crest.",
    Component: RangeLogo,
  },
  {
    id: "notch",
    name: "Notch",
    category: "mountain",
    description:
      "Single mountain with a Fuji-style V-notch at the summit. The notch is the entire refinement; everything else is silence. Strongest at display sizes; the notch closes up at 16px.",
    Component: NotchLogo,
  },
  {
    id: "peak",
    name: "Peak",
    category: "mountain",
    description:
      "Single bold isoceles triangle. The most minimal mountain — nothing earns its keep that doesn't have to be there. Survives at any size, including 16px. The most disciplined option.",
    Component: PeakLogo,
  },
  {
    id: "crest-outline",
    name: "Crest Outline",
    category: "mountain",
    description:
      "Line-art version of Crest. Lighter visual weight, same composition. For places the ink mark would be too heavy (small headers, watermarks, footers, og:image with a body of text alongside).",
    Component: CrestOutlineLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
