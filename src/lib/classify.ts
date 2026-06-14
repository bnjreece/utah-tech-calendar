import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db, events } from "@/lib/db";

/* Phase 1 (shadow) LLM classifier. A cheap Haiku pass that scores a
   scraped event on the same axes our heuristics use, plus a confidence.
   In shadow mode the verdict changes NOTHING - it is logged on the event
   (events.llmVerdict) and copied into the decision ledger when a human
   acts, so we can measure agreement before letting it act (Phase 3).
   Runs as a bounded post-scrape pass (classifyUnchecked), decoupled from
   ingestion so the LLM never slows scraping. No-ops without an API key. */

const MODEL = "claude-haiku-4-5-20251001";

/* Plain zod types only - no .email()/.url()/.min()/.max(): constraint- or
   pattern-emitting zod breaks Anthropic structured output (generateObject
   throws). Validate ranges in code instead. */
const VerdictSchema = z.object({
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

export interface ClassifyInput {
  title: string;
  description?: string | null;
  venueName?: string | null;
  city?: string | null;
  source?: string | null;
  link?: string | null;
}

const SYSTEM = `You are a strict curator for "Utah Tech Calendar", a calendar of IN-PERSON Utah technology events: developer meetups, engineering talks, hackathons, startup/founder events, tech conferences, and tech-company socials.

Classify ONE event. Definitions:
- isTechRelevant: true for software/hardware/data/AI/security/startup/founder/maker events and tech-company talks. FALSE for generic business networking, MLM / "make money" dinners, real estate, cert-exam-cram marketing (CCNA/CISSP/PMP/Six Sigma bootcamps sold as ads), art shows, fitness/runs, music/raves, religious or wellness events, kids crafts.
- isSpam: true for low-quality lead-gen / ad-spam (mass-templated "Specialists / Connect / Ignite Your Career" listings, paid cert-mill ads, "Dinner with Entrepreneurs" franchises).
- isOnline: true only if the event is virtual / online-only (webinar, Zoom, livestream). A real physical venue means false.
- isPaid: true if it is a ticketed paid training/conference with a real price (not a free community meetup).
- category: a short label (e.g. "developer meetup", "conference", "cert-spam", "networking-spam", "not-tech").
- suggestedTags: 0-4 lowercase topic tags (e.g. ai, cybersecurity, fintech, rust, startup). Only confident ones.
- confidence: a number 0..1 - your confidence in isTechRelevant and isSpam.
- reasoning: one short sentence.`;

export async function classifyEvent(input: ClassifyInput): Promise<EventVerdict | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: VerdictSchema,
      abortSignal: AbortSignal.timeout(20_000),
      system: SYSTEM,
      prompt: [
        `Title: ${input.title}`,
        input.description ? `Description: ${String(input.description).slice(0, 800)}` : "",
        input.venueName ? `Venue: ${input.venueName}` : "",
        input.city ? `City: ${input.city}` : "",
        input.source ? `Source: ${input.source}` : "",
        input.link ? `Link: ${input.link}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    /* Clamp confidence defensively - the model can return out of range. */
    const confidence = Math.max(0, Math.min(1, Number(object.confidence) || 0));
    return { ...object, confidence };
  } catch (err) {
    console.warn("[classify] failed", err);
    return null;
  }
}

/* Classify a bounded batch of upcoming events that have never been
   classified (llm_checked_at IS NULL). Called after each scrape tick and
   from scripts/classify-backlog.ts. Bounded by `limit` so a tick's cost +
   latency stay predictable; the backlog drains over several ticks. A null
   verdict (transient failure) leaves llm_checked_at NULL so it retries
   next time. No-ops fast without an API key. */
export async function classifyUnchecked(
  limit = 25,
): Promise<{ scanned: number; classified: number }> {
  if (!process.env.ANTHROPIC_API_KEY) return { scanned: 0, classified: 0 };
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      venueName: events.venueName,
      city: events.city,
      source: events.source,
      link: events.link,
    })
    .from(events)
    .where(and(isNull(events.llmCheckedAt), gte(events.startsAt, new Date())))
    .limit(limit);

  let classified = 0;
  for (const r of rows) {
    const verdict = await classifyEvent(r);
    if (!verdict) continue;
    await db
      .update(events)
      .set({ llmVerdict: verdict, llmCheckedAt: new Date() })
      .where(eq(events.id, r.id));
    classified++;
  }
  return { scanned: rows.length, classified };
}
