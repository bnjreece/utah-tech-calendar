import { db, events, pendingSubmissions, reviewDecisions } from "@/lib/db";

/* Append-only moderation ledger writes. Best-effort by design: a ledger
   failure must NEVER break the admin action it records (mirrors recordRun
   in scrape-runner). The snapshot freezes what the decider saw plus the
   heuristic flags the auto-classifier had set, so the LLM funnel can later
   learn from human judgment - especially the cases where a human
   disagreed with the heuristics. See schema.ts `reviewDecisions`. */

type EventRow = typeof events.$inferSelect;
type SubmissionRow = typeof pendingSubmissions.$inferSelect;

export type DecisionKind = "approve" | "reject" | "hide" | "restore";
export type DecisionChannel = "admin-ui" | "magic-link" | "auto";

/* Record a decision on a scraped event. Pass the row as read BEFORE the
   status UPDATE so prior_status + the snapshot reflect what the decider
   acted on. */
export async function recordEventDecision(
  before: EventRow,
  decision: DecisionKind,
  opts: {
    newStatus: string;
    decidedBy: string;
    channel: DecisionChannel;
    reason?: string | null;
  },
): Promise<void> {
  try {
    await db.insert(reviewDecisions).values({
      subjectType: "scraped_event",
      subjectId: before.id,
      decision,
      reason: opts.reason ?? null,
      priorStatus: before.status,
      newStatus: opts.newStatus,
      decidedBy: opts.decidedBy,
      channel: opts.channel,
      sourceId: before.sourceId ?? null,
      adapter: before.source,
      /* The classifier's shadow verdict at decision time - this paired with
         the human decision is the agree/disagree signal Phase 2+ mines. */
      llmVerdict: before.llmVerdict ?? null,
      snapshot: {
        title: before.title,
        description: before.description,
        link: before.link,
        source: before.source,
        venueName: before.venueName,
        address: before.address,
        city: before.city,
        isOnline: before.isOnline,
        tags: before.tags,
        /* The heuristic verdict at decision time - the signal that lets us
           mine "human overruled the auto-classifier" examples later. */
        flags: {
          isConference: before.isConference,
          isPaid: before.isPaid,
          hiddenReason: before.hiddenReason,
        },
      },
    });
  } catch (err) {
    console.warn("[review-log] event decision insert failed", err);
  }
}

/* Record a decision on a /submit draft (event or source suggestion),
   from either the admin UI or the magic-link path. */
export async function recordSubmissionDecision(
  before: SubmissionRow,
  decision: DecisionKind,
  opts: {
    subjectType: "submission_event" | "submission_source";
    newStatus: string;
    decidedBy: string;
    channel: DecisionChannel;
  },
): Promise<void> {
  try {
    await db.insert(reviewDecisions).values({
      subjectType: opts.subjectType,
      subjectId: before.id,
      decision,
      reason: null,
      priorStatus: before.status,
      newStatus: opts.newStatus,
      decidedBy: opts.decidedBy,
      channel: opts.channel,
      sourceId: null,
      adapter: null,
      snapshot: {
        payload: before.payload,
        submitterEmail: before.submitterEmail,
        submitterName: before.submitterName,
      },
    });
  } catch (err) {
    console.warn("[review-log] submission decision insert failed", err);
  }
}
