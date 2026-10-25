import {
  CRYPTO_RE,
  PROTECTED_VERTICAL_RE,
  routeVerdict,
  type EventVerdict,
} from "@/lib/verdict";

/* Queue autopilot: decides a PENDING scraped event right after the classifier
   scores it, so the review queue drains without a human. Pure (no DB): the
   caller (classifyUnchecked) gathers the DB facts into ctx and applies the
   result with one guarded write. Rules run in order; the first that fires
   wins:
     0. eligibility (pending, unlocked, scraped, upcoming)
     1. structural hide (patterns proven to be junk, checked before the model)
     2. duplicate hide (same event already approved, or pending earlier)
     3. policy holds (crypto, protected verticals, southern/rural Utah)
     4. auto-reject (a confident "no" from the model)
     4b. low-confidence yes (a "yes" under LOWCONF_YES_BAR is hidden)
     5. auto-publish (only with AUTOPILOT_PUBLISH=on, at most 8 per run)
     6. everything else stays pending; unreviewed rows expire hidden.
   Duplicates already sitting in the queue are hidden by the dedup sweep
   (lib/queue-twins.ts), not here. */

export type AutopilotAction = "hide" | "publish" | "hold";

export interface AutopilotDecision {
  action: AutopilotAction;
  /* Ledger reason for hide/publish ("autopilot:..."); a "hold:..." label
     otherwise (never written, used by the replay script and tests). */
  reason: string;
  hiddenReason?: "spam" | "cross-post" | "llm-screened";
}

export interface AutopilotRow {
  title: string;
  description: string | null;
  venueName: string | null;
  city: string | null;
  isOnline: boolean;
  /* Includes the source's defaultTags ("blockchain" on the crypto sources). */
  tags?: string[] | null;
  source: string;
  status: string;
  statusLocked: boolean;
  startsAt: Date;
}

export interface AutopilotCtx {
  now: Date;
  /* sources.url of the row's source_id (null if unknown). */
  sourceUrl: string | null;
  /* Same normalized title + same Denver date as an approved row or an
     earlier-created pending row. */
  duplicate: boolean;
  /* Other rows from the same source_id with the same title created in the
     last 30 days. */
  seriesCount: number;
  publishEnabled: boolean;
  publishedThisRun: number;
}

export const MAX_PUBLISH_PER_RUN = 8;

/* Rule 4b. A "yes" (tech and not spam) below this confidence is hidden
   instead of held. From the ledger on 2026-10-25: of 17 such verdicts a
   human kept 2 and hid 15, while 0.85 to 0.89 kept 7 of 10. Hides are
   restorable from /admin/hidden and listed in the daily digest. */
export const LOWCONF_YES_BAR = 0.85;

/* Lowercase, drop punctuation and ticket-tier words, so two listings of one
   event ("HackerX - Employer Ticket" and "HackerX") compare equal. */
const TIER_RE =
  /\b(employer tickets?|hiring partner( tickets?)?|vendor pass(es)?|general admission|early bird|student tickets?|vip)\b/g;
export function normalizeEventTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(TIER_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Rule 1 patterns, each taken from rows in the queue. */
const ELEVATING_RE = /elevating your potential/i;
const VENUE_MILL_RE = /for venue details reach us/i;
const PROVO_TECH_SOURCE = "ut--provo/tech--events";
const ATHLETICS_RE =
  /\b(pregame|sideline|gameday|game day|cougar walk|halftime|football delivery|tailgate)\b/i;

export function structuralHide(row: AutopilotRow, sourceUrl: string | null): string | null {
  if (ELEVATING_RE.test(row.title)) return "elevating";
  if (row.venueName && VENUE_MILL_RE.test(row.venueName)) return "venue-mill";
  if (sourceUrl?.includes(PROVO_TECH_SOURCE) && ATHLETICS_RE.test(row.title))
    return "byu-athletics";
  return null;
}

/* Rule 3 widening of the protected verticals, pending rows only (the shared
   PROTECTED_VERTICAL_RE is unchanged so approved-row routing is unchanged). */
const PROTECTED_EXTRA_RE = /\b(biolog|iso ?10993|space\b|astronaut|satellite)/;
const RURAL_CITY_RE =
  /\b(st\.? ?george|saint george|cedar city|hurricane|logan|washington|ivins|kanab|moab|vernal|price)\b/i;

/* Rule 5 publish vetoes. Employer / recruiter / vendor tiers of a real event
   are not community tickets (salvaged from the parked autoapprove branch). */
export const NOT_COMMUNITY_RE =
  /\b(employer|recruiter|recruiting|sponsor|sponsorship|exhibitor|vendor|hiring[\s-]*partner)[\s-]*(ticket|tickets|pass|passes|admission|booth|table)\b/i;
const CLOSED_EVENT_RE =
  /\b(members?[\s-]*only|orientation|invite[\s-]*only|invitation only|advisory board|participants?[\s-]*only|board meeting)\b/i;
/* Events aimed at children (the Moonpreneur free-trial "Robotics/STEM Class
   for Kids" listings) go to a human; they are never hidden by this. */
const KIDS_AUDIENCE_RE =
  /\b(for kids|kids ages|for children|for teens|teens|for parents)\b|\bages?\s*\d+\s*(-|–|to)\s*\d+/i;
const VAGUE_VENUE_RE = /^\s*$|\b(tbd|tba|to be announced|online|virtual)\b/i;

export function decidePending(
  row: AutopilotRow,
  v: EventVerdict,
  ctx: AutopilotCtx,
): AutopilotDecision {
  const hold = (why: string): AutopilotDecision => ({ action: "hold", reason: `hold:${why}` });

  /* 0. Eligibility. The caller also checks llm_gate_enabled. */
  if (
    row.status !== "pending" ||
    row.statusLocked ||
    row.source === "manual" ||
    row.startsAt.getTime() <= ctx.now.getTime()
  )
    return hold("ineligible");

  /* 1. Structural hide. */
  const struct = structuralHide(row, ctx.sourceUrl);
  if (struct)
    return { action: "hide", reason: `autopilot:struct:${struct}`, hiddenReason: "spam" };

  /* 2. Duplicate hide. Runs before the crypto hold (spec order, accepted on
     purpose): a crypto cross-post is hidden only because an approved or
     earlier pending twin of it exists, so nothing reaches the public
     calendar without a human, and the hide is restorable on /admin/hidden. */
  if (ctx.duplicate)
    return { action: "hide", reason: "autopilot:dup", hiddenReason: "cross-post" };

  /* 3. Policy holds. */
  const conf = Number(v.confidence) || 0;
  const hay = `${(v.category || "").toLowerCase()} ${row.title}`.toLowerCase();
  const saysNo = !v.isTechRelevant || v.isSpam;
  /* Crypto is checked on the model's tags and the row's tags too: listings
     from the crypto sources ("Primitive", "The Capital Room") often do not
     say crypto in the title or category. */
  const cryptoHay =
    `${hay} ${(v.suggestedTags ?? []).join(" ")} ${(row.tags ?? []).join(" ")}`.toLowerCase();
  if (CRYPTO_RE.test(cryptoHay)) return hold("crypto");
  if (saysNo && (PROTECTED_VERTICAL_RE.test(hay) || PROTECTED_EXTRA_RE.test(hay)))
    return hold("protected");
  if (saysNo && conf < 0.95 && row.city && RURAL_CITY_RE.test(row.city)) return hold("rural");
  /* Kids events always go to a human: real youth coding classes are
     protected from auto-hide, and paid edtech free-trial funnels look like
     them, so neither side is safe to automate. */
  if (KIDS_AUDIENCE_RE.test(row.title)) return hold("kids-audience");

  /* 4. Auto-reject. Eventbrite's keyword searches are the noisiest source,
     so its bar is lower (0.85) than everyone else's (0.90). */
  const bar = row.source === "eventbrite" ? 0.85 : 0.9;
  const route = routeVerdict(v, bar, row.title);
  if (route === "screen")
    return { action: "hide", reason: "autopilot:screen", hiddenReason: "llm-screened" };

  /* 4b. Low-confidence yes. Runs after the policy holds, so crypto and
     kids events still reach a human. The protected-vertical and rural holds
     above only cover a "no", so they are repeated here for an unsure "yes":
     those events go to a human rather than being hidden. */
  if (!saysNo && conf < LOWCONF_YES_BAR) {
    if (PROTECTED_VERTICAL_RE.test(hay) || PROTECTED_EXTRA_RE.test(hay)) return hold("protected");
    if (row.city && RURAL_CITY_RE.test(row.city)) return hold("rural");
    return { action: "hide", reason: "autopilot:lowconf-yes", hiddenReason: "llm-screened" };
  }

  /* 5. Auto-publish. */
  if (route !== "keep" || conf < 0.9) return hold("unsure");
  if (v.isOnline || row.isOnline) return hold("online");
  if (NOT_COMMUNITY_RE.test(row.title) || CLOSED_EVENT_RE.test(row.title))
    return hold("not-community");
  const venue = (row.venueName ?? "").trim();
  if ((row.description ?? "").trim().length < 40 && !venue) return hold("thin");
  if (row.source === "eventbrite" && VAGUE_VENUE_RE.test(venue)) return hold("venue");
  if (ctx.seriesCount >= 3) return hold("series");
  if (!ctx.publishEnabled) return hold("publish-off");
  if (ctx.publishedThisRun >= MAX_PUBLISH_PER_RUN) return hold("publish-cap");
  return { action: "publish", reason: "autopilot:publish" };
}

/* /submit drafts. Payload startsAt comes from the form as a naive local time
   ("2026-11-17T17:00"), which JS parses as UTC, up to 7h early. The grace
   keeps an evening event from expiring before it starts. */
const SUBMISSION_EXPIRE_GRACE_MS = 12 * 60 * 60 * 1000;
export function submissionPastDated(payload: { startsAt?: string }, now: Date): boolean {
  const t = payload.startsAt ? new Date(payload.startsAt).getTime() : NaN;
  return Number.isFinite(t) && t + SUBMISSION_EXPIRE_GRACE_MS < now.getTime();
}

/* The YYYY-MM-DD prefix, only when it is a real calendar date, so a bad
   value like 2026-02-31 never reaches the ::date cast and throws. */
export function validDay(startsAt: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startsAt ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === m[0] ? m[0] : null;
}
