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

/* Color tokens lifted verbatim from lib/digest.ts so admin alerts and
   the subscriber digest stay visually consistent. PAPER / INK /
   INK_SOFT match the site background, body type, and secondary text;
   SUNSET_DEEP is the conference / urgent terracotta; DUSK_DEEP is the
   paid / warn slate-blue. */
const PAPER = "#FBF7EE";
const INK = "#1B1B1B";
const INK_SOFT = "#6B6757";
const SUNSET_DEEP = "#B23A1F";
const DUSK_DEEP = "#3F4E5E";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Hard cap so a pathological "every source broken" run can't produce a
   10MB email body. detectAlerts already self-caps stale-source alerts
   to 5 + overflow; this catches the unbounded source_error and
   cookie_age_* paths. Urgent alerts go first so warns get truncated
   when over the cap. */
const ALERT_BODY_CAP = 15;

function buildAlertEmail(alerts: SourceAlert[]): { subject: string; text: string; html: string } {
  const urgent = alerts.filter((a) => a.level === "urgent").length;
  const warn = alerts.filter((a) => a.level === "warn").length;
  const sorted = [...alerts].sort((a, b) => {
    if (a.level !== b.level) return a.level === "urgent" ? -1 : 1;
    return 0;
  });
  const shown = sorted.slice(0, ALERT_BODY_CAP);
  const overflowCount = Math.max(0, alerts.length - ALERT_BODY_CAP);
  /* Subject mirrors the digest's "<count> Utah tech events…" rhythm:
     editorial number + noun + tail. No bracketed "[Utah Tech Calendar]"
     prefix; the from-name already carries that. */
  const subject =
    urgent > 0
      ? `${urgent} urgent source ${urgent === 1 ? "issue" : "issues"}${warn > 0 ? `, ${warn} warn` : ""}`
      : `${warn} source ${warn === 1 ? "warning" : "warnings"}`;

  const text = [
    "Utah Tech Calendar",
    "Source health",
    "",
    `${urgent} urgent · ${warn} warn`,
    "",
    ...shown.map((a) => `[${a.level.toUpperCase()}] ${a.title}\n  ${a.body}${a.action ? `\n  → ${a.action}` : ""}`),
    ...(overflowCount > 0 ? [`+${overflowCount} more · open dashboard for the full list`] : []),
    "",
    `Open dashboard: ${SITE_URL}/admin`,
    `Mute or change settings: ${SITE_URL}/admin/notifications`,
  ].join("\n");

  const items = shown
    .map((a) => {
      const eyebrowColor = a.level === "urgent" ? SUNSET_DEEP : DUSK_DEEP;
      return `<tr>
      <td style="padding:18px 0 18px 0;border-top:1px solid ${INK}26;">
        <span style="display:inline-block;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:${eyebrowColor};margin-bottom:8px;">${a.level}</span>
        <div style="font-family:Georgia,'DM Serif Display',serif;font-size:20px;line-height:1.25;color:${INK};font-style:italic;letter-spacing:-0.005em;">${escapeHtml(a.title)}</div>
        <div style="margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:${INK_SOFT};">${escapeHtml(a.body)}</div>
        ${a.action ? `<div style="margin-top:10px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${SUNSET_DEEP};">${escapeHtml(a.action)}</div>` : ""}
      </td>
    </tr>`;
    })
    .join("");

  /* Layout mirrors lib/digest.ts: 600px content table on a #FBF7EE
     background, IBM Plex Mono eyebrow → Georgia italic headline at
     36px/-0.01em (matches "This week in Utah tech."), IBM Plex Mono
     subhead for the urgent/warn tally, then the alert list. Footer
     has the digest's 2px solid INK border. */
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${PAPER};">
        <tr>
          <td style="padding-bottom:20px;">
            <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT};">Utah Tech Calendar</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;">
            <h1 style="margin:0;font-family:Georgia,'DM Serif Display',serif;font-style:italic;font-size:36px;line-height:1.1;color:${INK};letter-spacing:-0.01em;">Source health.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;">
            <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};">${urgent} urgent · ${warn} warn</span>
          </td>
        </tr>
        ${items}
        ${overflowCount > 0 ? `<tr><td style="padding:20px 0;border-top:1px solid ${INK}26;"><span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};">+${overflowCount} more · open dashboard for the full list</span></td></tr>` : ""}
        <tr>
          <td style="padding-top:40px;border-top:2px solid ${INK};">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:${INK_SOFT};margin:16px 0 0;">
              <a href="${SITE_URL}/admin" style="color:${INK};text-decoration:underline;">Open dashboard</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/admin/notifications" style="color:${INK};text-decoration:underline;">Mute or change settings</a>
            </p>
            <p style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};margin:24px 0 0;">
              admin · cottonwood heights, ut
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

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
