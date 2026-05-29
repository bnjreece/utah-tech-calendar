import { NextRequest } from "next/server";
import { runAllEnabledSources } from "@/lib/scrape-runner";

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
  const results = await runAllEnabledSources();
  return Response.json({
    ok: true,
    count: results.length,
    summary: {
      ok: results.filter((r) => r.status === "ok").length,
      error: results.filter((r) => r.status === "error").length,
      inserted: results.reduce((s, r) => s + r.inserted, 0),
      updated: results.reduce((s, r) => s + r.updated, 0),
    },
    results,
  });
}
