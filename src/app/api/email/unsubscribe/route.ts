import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { verifySubscriptionToken } from "@/lib/subscription-token";

/* RFC 8058 one-click POST endpoint. Email clients post here when the
   recipient hits "Unsubscribe" in Gmail/Yahoo without confirming via
   the landing page. Token comes in via the query string; List-
   Unsubscribe-Post: List-Unsubscribe=One-Click is sent in the email
   header so the receiver knows to POST. */

async function handle(token: string | null) {
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
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

export async function POST(req: Request) {
  const url = new URL(req.url);
  return handle(url.searchParams.get("token"));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return handle(url.searchParams.get("token"));
}
