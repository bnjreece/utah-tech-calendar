import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, adminSettings, sources } from "@/lib/db";
import { detectAlerts, hashAlerts, type SourceAlert } from "@/lib/health";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

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

const PAPER = "#FBF7EE";
const INK = "#1B1B1B";
const INK_SOFT = "#6B6757";
const SUNSET = "#B23A1F";
const DUSK = "#3F4E5E";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAlertEmail(alerts: SourceAlert[]): { subject: string; text: string; html: string } {
  const urgent = alerts.filter((a) => a.level === "urgent").length;
  const warn = alerts.filter((a) => a.level === "warn").length;
  const subject =
    urgent > 0
      ? `[Utah Tech Calendar] ${urgent} urgent · ${warn} warn`
      : `[Utah Tech Calendar] ${warn} warn`;

  const text = [
    "Utah Tech Calendar - source health",
    "",
    `${urgent} urgent / ${warn} warn`,
    "",
    ...alerts.map((a) => `[${a.level.toUpperCase()}] ${a.title}\n  ${a.body}${a.action ? `\n  -> ${a.action}` : ""}`),
    "",
    `Admin dashboard: ${SITE_URL}/admin`,
    `Mute or change settings: ${SITE_URL}/admin/notifications`,
  ].join("\n");

  const items = alerts
    .map((a) => {
      const color = a.level === "urgent" ? SUNSET : DUSK;
      return `<tr><td style="padding:14px 0;border-top:1px solid ${INK}26;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${color};">${a.level}</div>
        <div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:${INK};margin-top:4px;">${escapeHtml(a.title)}</div>
        <div style="font-family:-apple-system,sans-serif;font-size:13px;color:${INK_SOFT};margin-top:6px;">${escapeHtml(a.body)}</div>
        ${a.action ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${SUNSET};margin-top:6px;">${escapeHtml(a.action)}</div>` : ""}
      </td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER};color:${INK};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
  <tr><td style="padding-bottom:16px;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT};">Utah Tech Calendar · admin</span>
    <h1 style="margin:12px 0 4px;font-family:Georgia,serif;font-style:italic;font-size:30px;color:${INK};">Source health.</h1>
    <p style="margin:0;font-family:-apple-system,sans-serif;font-size:14px;color:${INK_SOFT};">${urgent} urgent · ${warn} warn</p>
  </td></tr>
  ${items}
  <tr><td style="padding-top:32px;border-top:2px solid ${INK};">
    <p style="font-family:-apple-system,sans-serif;font-size:13px;color:${INK_SOFT};margin:14px 0 0;">
      <a href="${SITE_URL}/admin" style="color:${INK};text-decoration:underline;">Open dashboard</a> ·
      <a href="${SITE_URL}/admin/notifications" style="color:${INK};text-decoration:underline;">Mute or change settings</a>
    </p>
  </td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const [settings] = await db.select().from(adminSettings).limit(1);
  if (!settings || !settings.alertEmail) {
    return Response.json({ ok: true, skipped: "no_alert_email" });
  }

  const sourceRows = await db.select().from(sources);
  const alerts = detectAlerts(sourceRows, { settings });
  if (alerts.length === 0) {
    return Response.json({ ok: true, skipped: "no_alerts" });
  }

  /* Dedup: if the alert set is identical to the last one we sent in
     the past 24h, skip. Beyond 24h we re-send as a heartbeat reminder
     that something is still broken. */
  const hash = hashAlerts(alerts);
  const lastSent = settings.lastAlertsSentAt
    ? new Date(settings.lastAlertsSentAt).getTime()
    : null;
  const ageMs = lastSent ? Date.now() - lastSent : Infinity;
  const SAME_AS_BEFORE = hash === settings.lastAlertsHash;
  const WITHIN_DAY = ageMs < 24 * 60 * 60 * 1000;
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  if (SAME_AS_BEFORE && WITHIN_DAY && !dryRun) {
    return Response.json({
      ok: true,
      skipped: "unchanged_within_24h",
      hash,
      alertCount: alerts.length,
    });
  }

  const content = buildAlertEmail(alerts);
  if (dryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      hash,
      alertCount: alerts.length,
      subject: content.subject,
    });
  }

  const result = await sendEmail({
    to: settings.alertEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  if (result.ok) {
    await db
      .update(adminSettings)
      .set({ lastAlertsSentAt: new Date(), lastAlertsHash: hash })
      .where(eq(adminSettings.id, 1));
  }

  return Response.json({
    ok: result.ok,
    sent: result.ok,
    hash,
    alertCount: alerts.length,
  });
}
