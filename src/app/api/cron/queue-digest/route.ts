import { NextRequest } from "next/server";
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

  const snapshot = await fetchQueueSnapshot();
  const total = snapshot.pendingEvents.length + snapshot.pendingSubmissions.length;
  if (total === 0) {
    /* Per "can skip if none" - no email when the queue is empty. The
       daily cadence is itself the recovery mechanism: if a queue grows
       overnight, tomorrow's 14:00 UTC run picks it up. */
    return Response.json({ ok: true, skipped: "queue_empty" });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const content = buildQueueDigestEmail(snapshot);
  if (dryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      total,
      pendingEvents: snapshot.pendingEvents.length,
      pendingSubmissions: snapshot.pendingSubmissions.length,
      subject: content.subject,
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
