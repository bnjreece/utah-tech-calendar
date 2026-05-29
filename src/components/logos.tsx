import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   MY TAKE
   ────────────────────────────────────────────────────────────── */

// 1. Wasatch Peaks — three-peak silhouette of the Wasatch range,
//    set on a hairline horizon. Most distinctively Utah.
export function WasatchLogo(props: Props) {
  return (
    <svg viewBox="0 0 64 32" fill="currentColor" aria-hidden {...props}>
      <path d="M 0 28 L 12 10 L 18 18 L 28 4 L 40 18 L 48 10 L 64 28 Z" />
      <rect x="0" y="28" width="64" height="0.75" />
    </svg>
  );
}

// 2. Beehive — three hexagons stacked into the state symbol.
//    Iconic Utah, instantly readable at favicon size.
export function BeehiveLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* top hex */}
      <polygon points="24,2 35,8 35,20 24,26 13,20 13,8" />
      {/* bottom row of two */}
      <polygon points="11,24 22,30 22,42 11,48 0,42 0,30" />
      <polygon points="37,24 48,30 48,42 37,48 26,42 26,30" />
    </svg>
  );
}

// 3. Sun & Horizon — half-disc sun over a horizon line.
//    Desert sunset minimalist, references the original strata identity.
export function SunHorizonLogo(props: Props) {
  return (
    <svg viewBox="0 0 64 36" fill="currentColor" aria-hidden {...props}>
      <path d="M 14 28 A 18 18 0 0 1 50 28 Z" />
      <rect x="0" y="28" width="64" height="0.75" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   MY TAKE + UI.SH DISCIPLINE
   Type-led, restrained, single-stroke, editorial.
   ────────────────────────────────────────────────────────────── */

// 4. UTE Monogram — the brand letters in Fraunces italic.
//    Periodical-style. Pairs with the wordmark but stands alone.
export function UteMonogramLogo(props: Props) {
  return (
    <svg viewBox="0 0 64 48" fill="currentColor" aria-hidden {...props}>
      <text
        x="32"
        y="34"
        textAnchor="middle"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="36"
        fontStyle="italic"
        fontWeight="500"
        letterSpacing="-0.02em"
      >
        ute
      </text>
    </svg>
  );
}

// 5. Asterisk & Rule — editorial section-break asterisk above a hairline.
//    The mark a New Yorker section opener would carry.
export function AsteriskLogo(props: Props) {
  return (
    <svg viewBox="0 0 64 36" fill="currentColor" aria-hidden {...props}>
      <text
        x="32"
        y="24"
        textAnchor="middle"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="32"
        fontWeight="500"
      >
        *
      </text>
      <rect x="14" y="32" width="36" height="1" />
    </svg>
  );
}

// 6. Italic e — the single italic e isolated from the wordmark.
//    Maximum brand alignment with maximum minimalism.
export function EMarkLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <text
        x="24"
        y="38"
        textAnchor="middle"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="48"
        fontStyle="italic"
        fontWeight="500"
        letterSpacing="-0.02em"
      >
        e
      </text>
    </svg>
  );
}

export const ALL_LOGOS = [
  {
    id: "wasatch",
    name: "Wasatch Peaks",
    category: "my take",
    description:
      "Three-peak silhouette of the Wasatch range on a hairline horizon. Most distinctively Utah. Strong silhouette at any size.",
    Component: WasatchLogo,
    aspect: "2:1",
  },
  {
    id: "beehive",
    name: "Beehive",
    category: "my take",
    description:
      "Three hexagons stacked into the state symbol. Iconic Utah, instantly readable at favicon size. Borrows civic authority.",
    Component: BeehiveLogo,
    aspect: "1:1",
  },
  {
    id: "sun",
    name: "Sun & Horizon",
    category: "my take",
    description:
      "Half-disc sun over a horizon line. Desert sunset minimalist. Carries the warmth of the original strata identity in a single mark.",
    Component: SunHorizonLogo,
    aspect: "2:1",
  },
  {
    id: "ute",
    name: "UTE Monogram",
    category: "ui.sh + my take",
    description:
      "The brand letters in Fraunces italic as a single mark. Periodical-style. Pairs with the wordmark but stands alone. Risk: shares letters with University of Utah Utes.",
    Component: UteMonogramLogo,
    aspect: "4:3",
  },
  {
    id: "asterisk",
    name: "Asterisk & Rule",
    category: "ui.sh + my take",
    description:
      "Editorial section-break asterisk above a hairline. The mark a New Yorker section opener would carry. Pure print discipline.",
    Component: AsteriskLogo,
    aspect: "2:1",
  },
  {
    id: "e-mark",
    name: "Italic e",
    category: "ui.sh + my take",
    description:
      "The single italic e from the wordmark, isolated as a mark. Maximum brand alignment with maximum minimalism. Reads as 'events' in shorthand.",
    Component: EMarkLogo,
    aspect: "1:1",
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
