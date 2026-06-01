import { asc, eq } from "drizzle-orm";
import { db, events, groups, pendingSubmissions, type Event } from "./db";
import { SITE_URL } from "./seo";
import { sourceLabel as resolveSourceLabel } from "./filters";
import { displayTitle } from "./display";

/* Tokens shared with lib/digest.ts and lib/health-alerts so all three
   editorial emails (weekly subscriber digest, daily source health,
   daily admin queue) read as one publication. */
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

interface PendingEventRow {
  event: Event;
  groupName: string | null;
}

interface PendingSubmissionRow {
  id: string;
  title: string;
  submitterEmail: string | null;
  submitterName: string | null;
  startsAtIso: string | null;
  venue: string | null;
  createdAt: Date;
}

export interface QueueSnapshot {
  pendingEvents: PendingEventRow[];
  pendingSubmissions: PendingSubmissionRow[];
}

export async function fetchQueueSnapshot(): Promise<QueueSnapshot> {
  const eventRows = await db
    .select({ event: events, group: groups })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.status, "pending"))
    .orderBy(asc(events.startsAt));

  const subRows = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.status, "pending"))
    .orderBy(asc(pendingSubmissions.createdAt));

  const pendingEvents: PendingEventRow[] = eventRows.map((r) => ({
    event: r.event,
    groupName: r.group?.name ?? null,
  }));

  const pendingSubs: PendingSubmissionRow[] = subRows.map((r) => {
    const p = (r.payload as Record<string, unknown>) ?? {};
    return {
      id: r.id,
      title: typeof p.title === "string" ? p.title : "(untitled draft)",
      submitterEmail: r.submitterEmail,
      submitterName: r.submitterName,
      startsAtIso: typeof p.startsAt === "string" ? p.startsAt : null,
      venue: typeof p.venueName === "string" ? p.venueName : null,
      createdAt: r.createdAt,
    };
  });

  return { pendingEvents, pendingSubmissions: pendingSubs };
}

/* Cottonwood Heights time formatter - matches digest.ts so the user
   reads the same "Mon Jun 8 · 12:00pm" stamp across all emails. */
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmtWhen(iso: string | Date | null): string {
  if (!iso) return "date tbd";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "date tbd";
  const date = DATE_FMT.format(d);
  const time = TIME_FMT.format(d).replace(" ", "").toLowerCase();
  return `${date} · ${time}`;
}

export function buildQueueDigestEmail(
  snapshot: QueueSnapshot,
): { subject: string; text: string; html: string } {
  const eventCount = snapshot.pendingEvents.length;
  const subCount = snapshot.pendingSubmissions.length;
  const total = eventCount + subCount;

  /* Subject mirrors the digest's "<count> Utah tech events…" rhythm.
     One number, one noun, optionally a tail when both queues populated.
     The cron route guards against `total === 0` before calling this
     function, but the function is exported - guard here too so a
     direct caller (preview script, test) doesn't render a nonsense
     "0 submissions" subject. */
  const subject = (() => {
    if (total === 0) return "Review queue is empty";
    if (eventCount > 0 && subCount > 0) {
      return `${total} in review · ${eventCount} scraped, ${subCount} submitted`;
    }
    if (eventCount > 0) {
      return `${eventCount} scraped event${eventCount === 1 ? "" : "s"} in review`;
    }
    return `${subCount} submission${subCount === 1 ? "" : "s"} in review`;
  })();

  const reviewUrl = `${SITE_URL}/admin/review`;
  const adminUrl = `${SITE_URL}/admin`;

  const textLines: string[] = [
    "Utah Tech Calendar",
    "Review queue",
    "",
    `${eventCount} scraped · ${subCount} submitted`,
    "",
  ];
  if (eventCount > 0) {
    textLines.push("SCRAPED EVENTS");
    for (const row of snapshot.pendingEvents) {
      const title = displayTitle({
        title: row.event.title,
        link: row.event.link,
        group: row.groupName ? { name: row.groupName } : null,
        source: row.event.source,
      });
      textLines.push(`  ${fmtWhen(row.event.startsAt)} - ${title}`);
      textLines.push(`    via ${resolveSourceLabel(row.event.source)}${row.groupName ? ` · ${row.groupName}` : ""}`);
      if (row.event.link) textLines.push(`    ${row.event.link}`);
      textLines.push("");
    }
  }
  if (subCount > 0) {
    textLines.push("SUBMITTED EVENTS");
    for (const row of snapshot.pendingSubmissions) {
      textLines.push(`  ${fmtWhen(row.startsAtIso)} - ${row.title}`);
      const submitter = row.submitterName ?? row.submitterEmail ?? "anonymous";
      textLines.push(`    from ${submitter} · received ${fmtWhen(row.createdAt)}`);
      textLines.push("");
    }
  }
  textLines.push(`Open review queue: ${reviewUrl}`);
  textLines.push(`Admin dashboard: ${adminUrl}`);

  const text = textLines.join("\n");

  const renderEventRow = (row: PendingEventRow): string => {
    const title = displayTitle({
      title: row.event.title,
      link: row.event.link,
      group: row.groupName ? { name: row.groupName } : null,
      source: row.event.source,
    });
    const sourceTag = resolveSourceLabel(row.event.source);
    const groupBit = row.groupName ? ` · ${escapeHtml(row.groupName)}` : "";
    const linkBit = row.event.link
      ? `<a href="${escapeHtml(row.event.link)}" style="color:${INK};text-decoration:underline;">source ↗</a>`
      : "";
    return `<tr>
      <td style="padding:14px 0;border-top:1px solid ${INK}26;">
        <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT};">
          ${escapeHtml(fmtWhen(row.event.startsAt))} · via ${escapeHtml(sourceTag.toLowerCase())}${groupBit}
        </div>
        <div style="margin-top:6px;font-family:Georgia,'DM Serif Display',serif;font-size:20px;line-height:1.25;color:${INK};font-style:italic;letter-spacing:-0.005em;">
          ${escapeHtml(title)}
        </div>
        ${linkBit ? `<div style="margin-top:6px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${INK_SOFT};">${linkBit}</div>` : ""}
      </td>
    </tr>`;
  };

  const renderSubRow = (row: PendingSubmissionRow): string => {
    const submitter = row.submitterName ?? row.submitterEmail ?? "anonymous";
    return `<tr>
      <td style="padding:14px 0;border-top:1px solid ${INK}26;">
        <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT};">
          ${escapeHtml(fmtWhen(row.startsAtIso))} · from ${escapeHtml(submitter)}
        </div>
        <div style="margin-top:6px;font-family:Georgia,'DM Serif Display',serif;font-size:20px;line-height:1.25;color:${INK};font-style:italic;letter-spacing:-0.005em;">
          ${escapeHtml(row.title)}
        </div>
        <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:${INK_SOFT};">
          Received ${escapeHtml(fmtWhen(row.createdAt))}${row.venue ? ` · ${escapeHtml(row.venue)}` : ""}
        </div>
      </td>
    </tr>`;
  };

  const sectionHeader = (label: string, count: number, color: string): string => `<tr>
    <td style="padding:28px 0 4px;">
      <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${color};">${label} · ${count}</span>
    </td>
  </tr>`;

  const eventSection =
    eventCount > 0
      ? sectionHeader("Scraped", eventCount, SUNSET_DEEP) +
        snapshot.pendingEvents.map(renderEventRow).join("")
      : "";
  const subSection =
    subCount > 0
      ? sectionHeader("Submitted", subCount, DUSK_DEEP) +
        snapshot.pendingSubmissions.map(renderSubRow).join("")
      : "";

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
            <h1 style="margin:0;font-family:Georgia,'DM Serif Display',serif;font-style:italic;font-size:36px;line-height:1.1;color:${INK};letter-spacing:-0.01em;">Review queue.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;">
            <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};">${eventCount} scraped · ${subCount} submitted</span>
          </td>
        </tr>
        ${eventSection}
        ${subSection}
        <tr>
          <td style="padding-top:40px;border-top:2px solid ${INK};">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:${INK_SOFT};margin:16px 0 0;">
              <a href="${reviewUrl}" style="color:${INK};text-decoration:underline;">Open review queue</a>
              &nbsp;·&nbsp;
              <a href="${adminUrl}" style="color:${INK};text-decoration:underline;">Admin dashboard</a>
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
