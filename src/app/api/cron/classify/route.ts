import { NextRequest } from "next/server";
import { classifyUnchecked } from "@/lib/classify";

export const runtime = "nodejs";
export const maxDuration = 300;

/* Classify-only endpoint: runs the Phase-1 shadow classifier over a bounded
   batch of unclassified upcoming events WITHOUT re-scraping any sources.
   Used to drain the backlog quickly (and to re-score after a prompt change)
   from the server side, where ANTHROPIC_API_KEY lives at runtime even when
   it's a sensitive/encrypted env var that can't be pulled locally. The
   scrape cron already runs classifyUnchecked(25) per tick for steady state;
   this is the manual, higher-throughput drain. Bearer CRON_SECRET auth,
   same as the scrape cron. */

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
  const raw = Number(new URL(request.url).searchParams.get("limit"));
  /* Bounded so a single invocation stays within maxDuration (each event is
     one sequential Haiku call). Default 100 ~= a few minutes. */
  const limit = Math.min(150, Math.max(1, Number.isFinite(raw) ? raw : 100));
  const result = await classifyUnchecked(limit);
  return Response.json({ ok: true, ...result });
}
