import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { verifySubscriptionToken } from "@/lib/subscription-token";

/* RFC 8058 one-click POST endpoint. Email clients POST here when the
   recipient hits "Unsubscribe" in Gmail/Yahoo without confirming via
   the landing page. Token is in the query string; the body MUST
   contain `List-Unsubscribe=One-Click` per RFC 8058 §3.1.

   POST-only on purpose. Gmail's link prefetcher, antivirus URL scanners,
   and clipboard-preview services will GET any link they see, and a GET
   handler here would silently unsubscribe users the moment they opened
   the digest. The human-facing landing page at /unsubscribe/[token] is
   a separate route - that's the URL embedded in the email's footer
   "Unsubscribe" link. */

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  /* RFC 8058 compliance: body should carry the magic value. We accept
     either the canonical urlencoded form or a missing body (some clients
     skip it) - the signed token is the real auth. */
  try {
    const body = await req.text();
    if (body && !/(^|&)List-Unsubscribe=One-Click(&|$)/i.test(body)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  } catch {
    /* no body, OK - token still validates */
  }

  const payload = verifySubscriptionToken(token);
  if (!payload || payload.kind !== "unsubscribe") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await db
    .update(emailSubscriptions)
    .set({ unsubscribedAt: new Date(), verifiedAt: null })
    .where(eq(emailSubscriptions.id, payload.subscriptionId));
  return NextResponse.json({ ok: true });
}
