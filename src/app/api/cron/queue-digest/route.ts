import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, adminSettings } from "@/lib/db";
import { fetchQueueSnapshot, buildQueueDigestEmail } from "@/lib/queue-digest";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const [settings] = await db.select().from(adminSettings).limit(1);
  if (!settings || !settings.alertEmail) {
    return Response.json({ ok: true, skipped: "no_alert_email" });
  }

  /* Heartbeat - stamp the moment the cron actually started, before
     fetching the queue. /admin reads this to surface "queue digest
     ran X hours ago" so the admin can spot a silent cron outage even
     during empty-queue days. Skip on dryRun so a smoke-test doesn't
     pollute the heartbeat reading. */
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  if (!dryRun) {
    try {
      await db
        .update(adminSettings)
        .set({ lastQueueDigestRunAt: new Date() })
        .where(eq(adminSettings.id, 1));
    } catch (err) {
      console.warn("[queue-digest] heartbeat update failed", err);
    }
  }

  const snapshot = await fetchQueueSnapshot();
  const total = snapshot.pendingEvents.length + snapshot.pendingSubmissions.length;
  if (total === 0) {
    /* Per "can skip if none" - no email when the queue is empty. The
       daily cadence is itself the recovery mechanism: if a queue grows
       overnight, tomorrow's 14:00 UTC run picks it up. */
    return Response.json({ ok: true, skipped: "queue_empty" });
  }

  const content = buildQueueDigestEmail(snapshot);
  if (dryRun) {
    /* Include the rendered text/html bodies so the admin can curl
       the endpoint and inspect the exact email that would ship -
       gated behind the same Bearer auth as a live send, so no leak. */
    return Response.json({
      ok: true,
      dryRun: true,
      total,
      pendingEvents: snapshot.pendingEvents.length,
      pendingSubmissions: snapshot.pendingSubmissions.length,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }

  const result = await sendEmail({
    to: settings.alertEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return Response.json({
    ok: result.ok,
    sent: result.ok,
    total,
    subject: content.subject,
  });
}
