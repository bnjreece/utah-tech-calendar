import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/* ──────────────────────────────────────────────────────────────
   v2 — all marks now square (48×48) so they survive favicon use.
   Heavier weights, denser composition, tested at 16/32/48/64px.
   ────────────────────────────────────────────────────────────── */

/* ─── MY TAKE ────────────────────────────────────────────────── */

// 1. Wasatch Peaks — three sharp peaks edge-to-edge in the square,
//    hairline horizon, peaks taller so the silhouette dominates.
export function WasatchLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <path d="M 0 44 L 13 12 L 21 22 L 24 3 L 27 22 L 35 12 L 48 44 Z" />
      <rect x="0" y="44" width="48" height="1.25" />
    </svg>
  );
}

// 2. Beehive — actual domed silhouette in the Utah state seal style:
//    horizontal bands narrowing toward the top, on a base.
export function BeehiveLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Stacked bands narrowing toward top, classic beehive form */}
      <rect x="20" y="6"  width="8"  height="5" rx="2" />
      <rect x="16" y="13" width="16" height="5" rx="2" />
      <rect x="12" y="20" width="24" height="5" rx="2" />
      <rect x="8"  y="27" width="32" height="5" rx="2" />
      {/* Base platform */}
      <rect x="4"  y="36" width="40" height="4" />
      <rect x="2"  y="42" width="44" height="1" />
    </svg>
  );
}

// 3. Sun, horizon, range — half-sun above horizon with a faint
//    mountain ridge in the foreground. Earns the square frame.
export function SunHorizonLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      {/* Sun: top half of a disc, sitting on the horizon */}
      <path d="M 8 26 A 16 16 0 0 1 40 26 Z" />
      {/* Horizon */}
      <rect x="0" y="26" width="48" height="1.25" />
      {/* Distant mountain ridge in the foreground */}
      <path d="M 0 38 L 7 32 L 13 36 L 22 30 L 32 35 L 41 30 L 48 34 L 48 42 L 0 42 Z" opacity="0.35" />
    </svg>
  );
}

/* ─── UI.SH + MY TAKE ────────────────────────────────────────── */

// 4. UTE — Fraunces italic, weight 600, centered, tight tracking.
//    Periodical mark feel; warned to user re: U-of-U Utes overlap.
export function UteMonogramLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="30"
        fontStyle="italic"
        fontWeight="600"
        letterSpacing="-0.04em"
      >
        ute
      </text>
      {/* Editorial hairline beneath, signals "periodical mark" */}
      <rect x="14" y="40" width="20" height="1" />
    </svg>
  );
}

// 5. Asterisk & Rule — bold Fraunces asterisk fully contained in viewBox,
//    generous rule below. Section-break mark from a print magazine.
export function AsteriskLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <text
        x="24"
        y="32"
        textAnchor="middle"
        dominantBaseline="alphabetic"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="30"
        fontWeight="600"
      >
        *
      </text>
      <rect x="10" y="40" width="28" height="1.5" />
    </svg>
  );
}

// 6. Italic e — vertically centered via dominantBaseline.
//    The italic e from the wordmark, isolated as a single mark.
export function EMarkLogo(props: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden {...props}>
      <text
        x="24"
        y="26"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily='"Fraunces", ui-serif, Georgia, serif'
        fontSize="32"
        fontStyle="italic"
        fontWeight="600"
        letterSpacing="-0.03em"
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
      "Three Wasatch peaks repacked into a square frame. Center peak tallest. Hairline horizon. Reads as Utah at 32px and up; at 16px the peaks blur — survivable as favicon but UTE / italic-e are stronger at that size.",
    Component: WasatchLogo,
  },
  {
    id: "beehive",
    name: "Beehive",
    category: "my take",
    description:
      "Actual domed silhouette built from stacked bands narrowing toward the top, on a base. Now reads as the Utah state seal beehive. Strong civic-symbol authority; works at all sizes.",
    Component: BeehiveLogo,
  },
  {
    id: "sun",
    name: "Sun, Horizon, Range",
    category: "my take",
    description:
      "Half-sun above a horizon with a faint mountain ridge in the foreground. Earns the square frame by adding the ridge. Carries warmth from the original strata identity.",
    Component: SunHorizonLogo,
  },
  {
    id: "ute",
    name: "UTE Monogram",
    category: "ui.sh + my take",
    description:
      "Fraunces italic ute at weight 600 with a hairline rule beneath. Periodical mark feel. Risk: shares letters with U of U's Utes; at favicon size three letters get squished.",
    Component: UteMonogramLogo,
  },
  {
    id: "asterisk",
    name: "Asterisk & Rule",
    category: "ui.sh + my take",
    description:
      "Bolder Fraunces asterisk above a generous rule. The mark a New Yorker section opener would carry. Pure print discipline. Holds up at favicon size because the asterisk has high recognizability.",
    Component: AsteriskLogo,
  },
  {
    id: "e-mark",
    name: "Italic e",
    category: "ui.sh + my take",
    description:
      "The single italic Fraunces e from the wordmark, isolated. Weight 600, tight tracking. Maximum brand alignment, maximum minimalism. Strongest at favicon size of any in the set.",
    Component: EMarkLogo,
  },
] as const;

export type LogoId = (typeof ALL_LOGOS)[number]["id"];
