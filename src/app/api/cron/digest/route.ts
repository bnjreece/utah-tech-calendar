import { NextRequest } from "next/server";
import { and, isNull, isNotNull, eq } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { queryEvents } from "@/lib/queries";
import { createSubscriptionToken } from "@/lib/subscription-token";
import { sendEmail } from "@/lib/email";
import { buildDigest } from "@/lib/digest";
import { absoluteUrl } from "@/lib/seo";

export const runtime = "nodejs";
export const maxDuration = 300;

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqualStrings(header.slice(7), secret);
}

/* Start of this ISO week (Monday 00:00 UTC). Idempotency anchor for
   the digest: if a subscriber's lastSentAt is >= this, they already
   got this week's send. A 24h guard wasn't enough - manually retrying
   on Tuesday after a Monday timeout would have resent the same week
   to everyone who succeeded on Monday. */
function thisWeekAnchorUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();                     // 0=Sun .. 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  return d;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  /* Week window: today (digest-day) → today + 7. The cron is scheduled
     for Monday morning MT but the window is "next 7 days" rather than
     calendar week so the email is useful whatever day it lands. */
  const weekStart = new Date();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = await queryEvents(
    {
      q: "",
      regions: [],
      cities: [],
      tags: [],
      sources: [],
      groups: [],
      types: [],
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
      showOnline: false,
    },
    200,
  );

  /* Skip people who unsubscribed or never verified. lastSentAt guard
     prevents accidental duplicate sends within the same 24h - useful
     when a cron is manually retried after a Vercel timeout. */
  const subs = await db
    .select()
    .from(emailSubscriptions)
    .where(
      and(
        isNotNull(emailSubscriptions.verifiedAt),
        isNull(emailSubscriptions.unsubscribedAt),
      ),
    );

  const now = new Date();
  const weekAnchor = thisWeekAnchorUTC(now);
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const sub of subs) {
    if (sub.lastSentAt && new Date(sub.lastSentAt).getTime() >= weekAnchor.getTime()) {
      skipped++;
      continue;
    }
    const unsubToken = createSubscriptionToken("unsubscribe", sub.id);
    const unsubscribeUrl = absoluteUrl(`/unsubscribe/${unsubToken}`);
    const content = buildDigest({ events, unsubscribeUrl, weekStart, weekEnd });
    if (dryRun) {
      sent++;
      continue;
    }
    const result = await sendEmail({
      to: sub.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      listUnsubscribe: `<${absoluteUrl(`/api/email/unsubscribe?token=${unsubToken}`)}>`,
    });
    if (result.ok) {
      sent++;
      await db
        .update(emailSubscriptions)
        .set({ lastSentAt: new Date() })
        .where(eq(emailSubscriptions.id, sub.id));
    } else {
      failed++;
    }
  }

  return Response.json({
    ok: true,
    weekStart,
    weekEnd,
    eventCount: events.length,
    subscriberCount: subs.length,
    sent,
    skipped,
    failed,
    dryRun,
  });
}
