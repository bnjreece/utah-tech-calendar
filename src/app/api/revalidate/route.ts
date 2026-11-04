import { NextRequest } from "next/server";
import { publicDataChanged } from "@/lib/public-data-invalidate";

export const runtime = "nodejs";

/* Marks the shared public dataset (lib/public-data.ts) stale, so the next
   page view refills it. For scripts that write public data outside the
   app, and for local checks. Bearer CRON_SECRET, same as the crons. No
   database access here. Marks it again 15 s later, like admin actions,
   in case a refill was running while the script wrote. */

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
  publicDataChanged();
  return Response.json({ ok: true });
}
