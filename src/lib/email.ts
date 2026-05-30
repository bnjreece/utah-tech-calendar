import { Resend } from "resend";

/* Best-effort email dispatcher. Failures log a warning and never throw -
   losing one transactional email is less bad than breaking the caller
   (a digest cron or a subscribe POST). Adapted from iamkeen's notify.ts
   pattern; ported to Resend since /api/submit already uses it. */

/* The dsynthetic Resend key is in the "bnjmn" Resend workspace, where
   only `updates.bnjmn.org` is a verified sending domain. Add bnjmn.org
   root (or events.bnjmn.org, or utahtech.events once DNS is fixed) as
   a verified domain in Resend if a cleaner from address is wanted. */
const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "Utah Tech Events <events@updates.bnjmn.org>";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /* List-Unsubscribe header value, e.g.
       <https://utahtech.events/unsubscribe/abc>, <mailto:u@example.com>
     Required for the digest to satisfy Gmail/Yahoo bulk-sender rules. */
  listUnsubscribe?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set - skipping:", input.subject, "→", input.to);
    return { ok: false };
  }
  try {
    const resend = new Resend(apiKey);
    const headers: Record<string, string> = {};
    if (input.listUnsubscribe) {
      headers["List-Unsubscribe"] = input.listUnsubscribe;
      /* RFC 8058 one-click unsubscribe - Gmail and Yahoo now expect this
         for bulk senders. The receiver POSTs to the URL in
         List-Unsubscribe; our /api/email/unsubscribe route accepts POST. */
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (result.error) {
      console.warn("[email] resend error", result.error, "subject:", input.subject);
      return { ok: false };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.warn("[email] resend threw", err, "subject:", input.subject);
    return { ok: false };
  }
}
