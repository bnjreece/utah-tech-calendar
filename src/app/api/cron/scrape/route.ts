import { NextRequest } from "next/server";
import { runAllEnabledSources, expirePendingEvents } from "@/lib/scrape-runner";
import { classifyUnchecked } from "@/lib/classify";
import { closeStaleSubmissions } from "@/lib/submission-autoclose";
import { db, adminSettings } from "@/lib/db";
import { routeDeadline } from "@/lib/deadline";
import { publicDataChanged } from "@/lib/public-data-invalidate";
import { RECHECK_DELAY_MS, SCRAPE_CLOSING_RESERVE_MS } from "@/lib/public-data-timing";

/* This cron runs in sfo1 via vercel.json. Eventbrite's IAD CloudFront
   path returned repeated 502s while the same searches succeeded in SFO. */
export const runtime = "nodejs";
export const maxDuration = 300;

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqualStrings(header.slice(7), secret);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deadline = routeDeadline(maxDuration);
  /* Heartbeat - stamp the moment the cron actually started, before any
     fetch can fail. health.ts uses this to surface "the cron stopped
     firing" independently of any individual source's freshness.
     Upserts the singleton row so a fresh deploy (no /admin/notifications
     visit yet) still gets a heartbeat. Best-effort: a DB failure here
     shouldn't block the scrape itself. */
  try {
    const tickedAt = new Date();
    await db
      .insert(adminSettings)
      .values({ id: 1, lastScrapeTickAt: tickedAt })
      .onConflictDoUpdate({
        target: adminSettings.id,
        set: { lastScrapeTickAt: tickedAt },
      });
  } catch (err) {
    console.warn("[scrape] heartbeat update failed", err);
  }
  let results: Awaited<ReturnType<typeof runAllEnabledSources>>;
  try {
    results = await runAllEnabledSources();
  } catch (err) {
    /* Sources may already have written events before the throw (the
       dedup sweep runs last), so the public dataset is still marked
       stale. Next only flushes the mark for a returned response, so
       return the 500 instead of rethrowing. */
    console.error("[scrape] run failed", err);
    publicDataChanged();
    return Response.json({ ok: false, error: "scrape run failed" }, { status: 500 });
  }
  /* Phase 1 (shadow): classify a bounded batch of unclassified upcoming
     events. Decoupled from ingestion so the LLM never slows scraping; the
     backlog drains a few rows per tick. No-op without ANTHROPIC_API_KEY.
     Held to the deadline: a run killed at maxDuration never reaches
     publicDataChanged() below, which would leave this run's writes off
     the public pages until the next cron. */
  let classify = { scanned: 0, classified: 0, screened: 0, toReview: 0, published: 0, deferred: 0 };
  try {
    classify = await classifyUnchecked(25, { deadline, reserveMs: SCRAPE_CLOSING_RESERVE_MS });
  } catch (err) {
    console.warn("[scrape] classify pass failed", err);
  }
  /* Queue hygiene: a pending row whose date passed is unreviewable clutter
     in /admin/review and the daily digest. Best-effort. */
  let expired = 0;
  try {
    expired = await expirePendingEvents();
  } catch (err) {
    console.warn("[scrape] expire pass failed", err);
  }
  /* Submission hygiene: silently close past-dated and already-listed
     /submit drafts. Never emails, never approves. Best-effort. */
  let submissions = { expired: 0, duplicate: 0 };
  try {
    submissions = await closeStaleSubmissions();
  } catch (err) {
    console.warn("[scrape] submission close pass failed", err);
  }
  /* Public pages read one cached dataset (lib/public-data.ts). Marking it
     stale here means the next page view refills it (3 queries) while the
     database is still awake from this run, and the delayed second mark
     replaces any refill that read during the run
     (lib/public-data-invalidate.ts). One call covers the scrape,
     classify, dedup and expire passes. */
  if (deadline.remainingMs() < RECHECK_DELAY_MS + 5_000) {
    console.warn(
      `[scrape] ${deadline.remainingMs()} ms left: the delayed public-data mark may not run before maxDuration`,
    );
  }
  publicDataChanged();
  return Response.json({
    ok: true,
    count: results.length,
    expired,
    submissions,
    summary: {
      ok: results.filter((r) => r.status === "ok").length,
      error: results.filter((r) => r.status === "error").length,
      inserted: results.reduce((s, r) => s + r.inserted, 0),
      updated: results.reduce((s, r) => s + r.updated, 0),
    },
    classify,
    results,
  });
}
