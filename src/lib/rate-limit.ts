import type { NextRequest } from "next/server";
import { SITE_URL } from "./seo";

/* Minimal per-instance, per-IP rate limit. Vercel functions can
   horizontally scale, so this isn't a global ceiling - it's a
   per-instance floor that blocks the trivial flood case (one
   attacker hammering one URL). Combined with the Origin check
   below, it raises the bar from "trivial" to "needs distributed
   coordination" which is enough for a free public calendar. */

const BUCKETS: Map<string, { tokens: number; lastRefill: number }> = new Map();

function getClientIp(request: NextRequest): string {
  /* x-forwarded-for is a CSV; take the leftmost (closest to client). */
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

interface RateLimitOptions {
  /* How many tokens the bucket holds at full. */
  capacity: number;
  /* Tokens added per second (sustained rate). */
  refillPerSec: number;
}

export function rateLimit(
  request: NextRequest,
  scope: string,
  opts: RateLimitOptions,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = getClientIp(request);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = BUCKETS.get(key);
  if (!bucket) {
    BUCKETS.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return { ok: true };
  }
  /* Token-bucket refill. */
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsedSec * opts.refillPerSec);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    return { ok: false, retryAfterSec: Math.ceil(deficit / opts.refillPerSec) };
  }
  bucket.tokens -= 1;
  return { ok: true };
}

/* Best-effort Origin check. CSRF + cross-origin spam defense in one.
   Allows: same-origin requests, server-to-server (no Origin header),
   and requests from the canonical SITE_URL. Refuses requests from
   any other Origin so a malicious third-party site can't trigger
   side-effectful API calls from a visitor's browser. */
export function assertSameOrigin(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const origin = request.headers.get("origin");
  /* No Origin header is common for server-to-server requests and
     same-origin GET. We're on POST here; the modern browsers send
     Origin on every cross-origin POST. Absent header is acceptable
     for direct API testing but not for CSRF flow which would have
     the attacker site's origin. */
  if (!origin) return { ok: true };
  const allowed = [SITE_URL, "http://localhost:3000", "http://localhost:3001"];
  if (allowed.includes(origin)) return { ok: true };
  return { ok: false, reason: `Origin ${origin} not allowed` };
}
