import type { EventVerdict } from "@/lib/verdict";

/* Queue autopilot: decides a PENDING scraped event right after the classifier
   scores it. Pure (no DB): the caller (classifyUnchecked) gathers the DB
   facts into ctx and applies the result with one guarded write.

   No human review (owner ruling, 2026-11-22): every eligible row is
   published or hidden on this pass. Holds were expiring unseen (four human
   decisions in a month), which lost real events. Hides stay restorable from
   /admin/hidden and the digest lists the near misses. Rules run in order;
   the first that fires wins:
     0. eligibility (pending, unlocked, scraped, upcoming)
     1. structural hide (patterns proven to be junk, checked before the model)
     2. duplicate hide (same event already approved, or pending earlier)
     3. a "no" from the model is hidden, at any confidence
     4. kids-audience hide (edtech free-trial funnels look like real classes)
     4b. a "yes" under PUBLISH_BAR is hidden
     5. publish vetoes hide (online, employer/closed tiers, thin, vague
        Eventbrite venue, clinical training, a repeating listing under 0.90)
     6. publish (AUTOPILOT_PUBLISH=on, at most 8 per run). With publishing
        off, or past the cap, the row is held: that is the kill switch, not
        a review queue.
   Crypto, protected verticals (biotech, aerospace, robotics) and southern
   Utah used to wait for a human; they now follow the same rules.
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

/* Rule 6. A one-off "yes" publishes from here; a listing that repeats (3+
   copies from one source in 30 days) needs SERIES_PUBLISH_BAR. On the
   2026-10-25 ledger a human kept 7 of 10 yeses at 0.85 to 0.89. */
export const PUBLISH_BAR = LOWCONF_YES_BAR;
export const SERIES_PUBLISH_BAR = 0.9;

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

/* Rule 5 publish vetoes. Employer / recruiter / vendor tiers of a real event
   are not community tickets (salvaged from the parked autoapprove branch). */
const NOT_COMMUNITY_RE =
  /\b(employer|recruiter|recruiting|sponsor|sponsorship|exhibitor|vendor|hiring[\s-]*partner)[\s-]*(ticket|tickets|pass|passes|admission|booth|table)\b/i;
const CLOSED_EVENT_RE =
  /\b(members?[\s-]*only|orientation|invite[\s-]*only|invitation only|advisory board|participants?[\s-]*only|board meeting)\b/i;
/* Rule 4. Events aimed at children: the Moonpreneur free-trial "Robotics/STEM
   Class for Kids" listings, which real youth coding classes look like. */
const KIDS_AUDIENCE_RE =
  /\b(for kids|kids ages|for children|for teens|teens|for parents)\b|\bages?\s*\d+\s*(-|–|to)\s*\d+/i;
const VAGUE_VENUE_RE = /^\s*$|\b(tbd|tba|to be announced|online|virtual)\b/i;
/* Surgeon training reads as medtech to the model but is not a community event. */
const CLINICAL_TRAINING_RE = /\b(wet ?lab|surgery|surgical|cadaver|cme)\b/i;

export function decidePending(
  row: AutopilotRow,
  v: EventVerdict,
  ctx: AutopilotCtx,
): AutopilotDecision {
  const hold = (why: string): AutopilotDecision => ({ action: "hold", reason: `hold:${why}` });
  const hide = (why: string): AutopilotDecision => ({
    action: "hide",
    reason: `autopilot:${why}`,
    hiddenReason: "llm-screened",
  });

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

  /* 2. Duplicate hide. */
  if (ctx.duplicate)
    return { action: "hide", reason: "autopilot:dup", hiddenReason: "cross-post" };

  /* 3. The model's "no". */
  const conf = Number(v.confidence) || 0;
  if (!v.isTechRelevant || v.isSpam) return hide("screen");

  /* 4. Kids audience (a "yes" the model gives a free-trial funnel). */
  if (KIDS_AUDIENCE_RE.test(row.title)) return hide("kids-audience");
  if (conf < PUBLISH_BAR) return hide("lowconf-yes");

  /* 5. Publish vetoes. */
  if (v.isOnline || row.isOnline) return hide("veto:online");
  if (NOT_COMMUNITY_RE.test(row.title) || CLOSED_EVENT_RE.test(row.title))
    return hide("veto:not-community");
  if (CLINICAL_TRAINING_RE.test(row.title)) return hide("veto:clinical");
  const venue = (row.venueName ?? "").trim();
  if ((row.description ?? "").trim().length < 40 && !venue) return hide("veto:thin");
  if (row.source === "eventbrite" && VAGUE_VENUE_RE.test(venue)) return hide("veto:venue");
  if (ctx.seriesCount >= 3 && conf < SERIES_PUBLISH_BAR) return hide("veto:series");

  /* 6. Publish. */
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
