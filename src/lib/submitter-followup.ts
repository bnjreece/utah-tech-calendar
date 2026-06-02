import { sendEmail } from "./email";
import { SITE_NAME, SITE_URL } from "./seo";

/* Submitter follow-up emails. Sent when admin approves or rejects a
   pending submission via /admin/review (or the magic-link /moderate
   flow). Closes the loop so the submission flow feels like a real
   channel rather than a void.

   Best-effort: failures are logged but never throw. The admin action
   has already committed the DB change; an undeliverable email
   shouldn't roll that back. */

interface SubmitterContext {
  submitterEmail: string | null;
  submitterName: string | null;
}

interface EventFollowupArgs extends SubmitterContext {
  title: string;
  decision: "approved" | "rejected";
  /* Optional canonical URL when approved - used to point the
     submitter at where their event landed. */
  publishedUrl?: string;
}

interface SourceFollowupArgs extends SubmitterContext {
  url: string;
  decision: "approved" | "rejected";
}

const SIGNATURE = `— ${SITE_NAME}\n${SITE_URL}`;

export async function notifySubmitterEvent(args: EventFollowupArgs): Promise<void> {
  if (!args.submitterEmail) return;
  const greeting = args.submitterName ? `Hi ${args.submitterName},` : "Hi,";
  if (args.decision === "approved") {
    const body = [
      greeting,
      "",
      `Your event submission is live on ${SITE_NAME}:`,
      "",
      args.title,
      ...(args.publishedUrl ? ["", args.publishedUrl] : []),
      "",
      "Thanks for sending it our way. If anything's off, reply to this email and we'll fix it.",
      "",
      SIGNATURE,
    ].join("\n");
    await sendEmail({
      to: args.submitterEmail,
      subject: `Your event is live: ${args.title.slice(0, 80)}`,
      text: body,
    });
  } else {
    const body = [
      greeting,
      "",
      `We took a look at your submission and decided not to publish it this time:`,
      "",
      args.title,
      "",
      "A few common reasons: the event isn't in-person in Utah, the source looked promotional or paid-cert, the date had already passed, or it didn't fit the tech-and-tech-adjacent scope. If you think we got it wrong, reply with context.",
      "",
      SIGNATURE,
    ].join("\n");
    await sendEmail({
      to: args.submitterEmail,
      subject: `About your event submission`,
      text: body,
    });
  }
}

export async function notifySubmitterSource(args: SourceFollowupArgs): Promise<void> {
  if (!args.submitterEmail) return;
  const greeting = args.submitterName ? `Hi ${args.submitterName},` : "Hi,";
  if (args.decision === "approved") {
    const body = [
      greeting,
      "",
      `Thanks for the source suggestion. We registered the calendar at:`,
      "",
      args.url,
      "",
      "It'll start showing up on the schedule with the next scrape pass. The first round of events lands in our moderation queue before going live, so it may be a beat before you see anything.",
      "",
      SIGNATURE,
    ].join("\n");
    await sendEmail({
      to: args.submitterEmail,
      subject: `Your source suggestion is wired up`,
      text: body,
    });
  } else {
    const body = [
      greeting,
      "",
      `We took a look at the source you suggested:`,
      "",
      args.url,
      "",
      "We decided not to add it this round. Most often that's because the page doesn't expose a feed we can scrape, the events aren't in-person in Utah, or they're outside the tech-and-tech-adjacent scope. If you think we got it wrong, reply with context.",
      "",
      SIGNATURE,
    ].join("\n");
    await sendEmail({
      to: args.submitterEmail,
      subject: `About your source suggestion`,
      text: body,
    });
  }
}
