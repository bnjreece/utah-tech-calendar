import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, emailSubscriptions } from "@/lib/db";
import { createSubscriptionToken } from "@/lib/subscription-token";
import { sendEmail } from "@/lib/email";
import { buildVerifyEmail } from "@/lib/digest";
import { absoluteUrl } from "@/lib/seo";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().email().max(254),
  /* Optional URL search string captured from the FeedBuilder, e.g.
     "regions=Salt+Lake+County&tags=ai". The digest cron uses this to
     slice each subscriber's send to their declared filters. Empty or
     missing = full digest. We cap it short to keep the column from
     storing pathological values. */
  feedQuery: z.string().max(2048).optional(),
  /* honeypot - real users won't fill this */
  website: z.string().max(0).optional(),
});

/* Reject obviously-invalid filter strings before they hit the DB.
   parseFilters is permissive (drops unknown keys) so we don't need a
   full reparse; the size cap + a basic structural check is enough. */
function normalizeFeedQuery(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/^\?+/, "").trim();
  if (!trimmed) return null;
  try {
    const sp = new URLSearchParams(trimmed);
    const cleaned = sp.toString();
    return cleaned || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  /* Per-IP cap. The per-email short-circuit below stops a SINGLE victim
     from being bombed, but an attacker can still hammer unique addresses
     (victim+1@, victim+2@, ...) to fire many confirm emails and burn the
     sending quota. 5 in burst, then ~1 per 20s sustained. */
  const rl = rateLimit(req, "email-subscribe", { capacity: 5, refillPerSec: 0.05 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (parsed.website && parsed.website.length > 0) {
    /* Honeypot tripped - return 200 so we look like a normal success
       to the bot but skip all side effects. */
    return NextResponse.json({ ok: true });
  }

  const email = parsed.email.trim().toLowerCase();
  const feedQuery = normalizeFeedQuery(parsed.feedQuery);

  /* Idempotent + anti-bomb. We return `ok:true` in every legitimate
     branch so an attacker who knows a victim's email can't distinguish
     "already subscribed" from "newly created" - the response body is
     the same. */
  const [existing] = await db
    .select()
    .from(emailSubscriptions)
    .where(eq(emailSubscriptions.email, email))
    .limit(1);

  /* Already-verified, currently-subscribed: short-circuit. Without this,
     an attacker could POST repeatedly with a known victim email and
     either (a) flood their inbox with confirm-your-subscription emails,
     or (b) silently reset `verifiedAt: null` and stop their digests
     until they re-click. A verified subscriber can update their
     feedQuery by hitting POST again - they don't need to re-confirm,
     and an attacker can't steal the slot because the email column is
     unique and the verifiedAt check guards. */
  if (existing && existing.verifiedAt && !existing.unsubscribedAt) {
    if (feedQuery !== existing.feedQuery) {
      /* Slice changed - null lastSentAt so the next cron run delivers
         the new feed_query this same week. Without this, a user who
         re-subscribes Wednesday with a different filter has to wait
         until next Monday to see the new slice. */
      await db
        .update(emailSubscriptions)
        .set({ feedQuery, lastSentAt: null })
        .where(eq(emailSubscriptions.id, existing.id));
    }
    return NextResponse.json({ ok: true });
  }

  /* Soft per-row rate limit on verify emails. If we've sent a verify
     email to this row within the last 5 minutes, return ok without
     resending. Doesn't need a separate column - we treat `createdAt`
     as the "last verify sent" timestamp for unverified rows. (Once
     verified, we never enter this branch anyway.) */
  const RESEND_COOLDOWN_MS = 5 * 60 * 1000;
  if (existing && existing.createdAt && !existing.unsubscribedAt) {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ ok: true });
    }
  }

  let subscriptionId: string;
  if (existing) {
    subscriptionId = existing.id;
    /* Resurrecting an unsubscribed row, or re-issuing a verify token to
       a stale unverified row. Reset state + bump createdAt so the
       cooldown window restarts. Persist the new feedQuery now so the
       verification page doesn't have to know about it. */
    await db
      .update(emailSubscriptions)
      .set({ unsubscribedAt: null, verifiedAt: null, createdAt: new Date(), feedQuery })
      .where(eq(emailSubscriptions.id, existing.id));
  } else {
    const [created] = await db
      .insert(emailSubscriptions)
      .values({ email, feedQuery })
      .returning({ id: emailSubscriptions.id });
    subscriptionId = created.id;
  }

  const token = createSubscriptionToken("verify", subscriptionId);
  const verifyUrl = absoluteUrl(`/verify/${token}`);
  const content = buildVerifyEmail({ email, verifyUrl });
  await sendEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return NextResponse.json({ ok: true });
}
