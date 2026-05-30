import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, emailSubscriptions } from "@/lib/db";
import { createSubscriptionToken } from "@/lib/subscription-token";
import { sendEmail } from "@/lib/email";
import { buildVerifyEmail } from "@/lib/digest";
import { absoluteUrl } from "@/lib/seo";

const Body = z.object({
  email: z.string().email().max(254),
  /* honeypot - real users won't fill this */
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
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
     until they re-click. */
  if (existing && existing.verifiedAt && !existing.unsubscribedAt) {
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
       cooldown window restarts. */
    await db
      .update(emailSubscriptions)
      .set({ unsubscribedAt: null, verifiedAt: null, createdAt: new Date() })
      .where(eq(emailSubscriptions.id, existing.id));
  } else {
    const [created] = await db
      .insert(emailSubscriptions)
      .values({ email })
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
