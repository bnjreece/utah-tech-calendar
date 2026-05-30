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

  /* Idempotent. If the row exists and is already verified, just (re-)send
     a verify email - that lets a user re-confirm after losing the link.
     If not yet verified, reissue the token. */
  const [existing] = await db
    .select()
    .from(emailSubscriptions)
    .where(eq(emailSubscriptions.email, email))
    .limit(1);

  let subscriptionId: string;
  if (existing) {
    subscriptionId = existing.id;
    /* If they previously unsubscribed, clear that so the verification
       step can re-activate them. They have to click the link, so this
       is still consent-confirming. */
    if (existing.unsubscribedAt) {
      await db
        .update(emailSubscriptions)
        .set({ unsubscribedAt: null, verifiedAt: null })
        .where(eq(emailSubscriptions.id, existing.id));
    }
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
