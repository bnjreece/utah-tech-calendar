import { z } from "zod";

/* The classifier's verdict shape and the gate's routing rule. Pure (no DB,
   no AI SDK) so the autopilot rules in lib/autopilot.ts can be unit tested.
   Moved from lib/classify.ts; the two regexes are lifted to constants so the
   autopilot reuses them, otherwise unchanged. */

export const CRYPTO_RE =
  /(crypto|web3|blockchain|solana|ethereum|bitcoin|\bdefi\b|\bnft\b|mtndao|onchain)/;
export const PROTECTED_VERTICAL_RE =
  /(biotech|\bbio\b|bioutah|life ?science|clinical|pharma|medtech|health ?tech|genomic|medical device|aerospace|kids? ?cod|youth ?cod|code ?camp|coderdojo|hour of code|girls who code|first ?lego|robotics|\bstem\b)/;

/* Plain zod types only - no .email()/.url()/.min()/.max(): constraint- or
   pattern-emitting zod breaks Anthropic structured output (generateObject
   throws). Validate ranges in code instead. */
export const VerdictSchema = z.object({
  isTechRelevant: z.boolean(),
  isSpam: z.boolean(),
  isOnline: z.boolean(),
  isPaid: z.boolean(),
  category: z.string(),
  suggestedTags: z.array(z.string()),
  confidence: z.number(),
  reasoning: z.string(),
});

export type EventVerdict = z.infer<typeof VerdictSchema>;

export type RoutingAction = "keep" | "screen" | "review";

/* Map a verdict + confidence threshold to a routing action (gated autonomy).
   Conservative: only a CONFIDENT, clearly-junk event is hard-gated; anything
   borderline - or whose category looks like a real event type that might be a
   tech-adjacent vertical - goes to a human instead of being auto-screened.
   The ONLY thing we auto-hide is confident lead-gen / cert-mill ad spam;
   recognized tech-community verticals and crypto are always handed to a human. */
export function routeVerdict(
  v: EventVerdict,
  threshold: number,
  title = "",
): RoutingAction {
  const conf = Number(v.confidence) || 0;
  const cat = (v.category || "").toLowerCase();
  const hay = `${cat} ${title}`.toLowerCase();

  /* Crypto / web3 is allow-but-confirm (admin policy): NEVER auto-hide it and
     NEVER auto-publish it. Every crypto event - the mtndao builder scene, and
     even satirical ones like "ShillFest" - goes to the admin review queue so a
     human decides each. Intercepts before the keep/screen branches so a
     spam-looking title can't hard-gate it. */
  const isCrypto = CRYPTO_RE.test(hay);
  if (isCrypto) return "review";

  if (v.isTechRelevant && !v.isSpam) return "keep";

  /* Recognized tech-community verticals the model frequently mislabels as
     "not-tech" or even "spam" - a BioUtah member BBQ, a life-sciences seminar,
     a kids / youth CODING camp, a robotics club. These are NEVER hard-gated; a
     flagged one is handed to a human instead of auto-hidden. Checked against
     the model's category AND the title as a safety net (e.g. "Kids Code Camp"
     or a "BioUtah Member BBQ" must never auto-hide). */
  const protectedVertical = PROTECTED_VERTICAL_RE.test(hay);
  if (protectedVertical) return "review";

  /* Confident spam -> screen (lead-gen / cert-mill ad spam is the primary -
     and now only - thing we auto-hide). */
  if (v.isSpam && conf >= threshold) return "screen";

  /* Confident not-tech -> screen, UNLESS the category reads like a real event
     type a human should confirm (conference / meetup / hackathon / social...). */
  const protectedCat =
    /(conference|summit|convention|expo|meetup|hackathon|hike|social|mixer|festival)/.test(cat);
  if (!v.isTechRelevant && conf >= threshold && !protectedCat) return "screen";

  /* Everything else flagged -> admin review queue. */
  return "review";
}
