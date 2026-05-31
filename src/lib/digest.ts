import type { EventWithGroup } from "./queries";
import type { FilterState } from "./filters";
import { sourceLabel, TYPE_LABELS } from "./filters";
import { SITE_URL, absoluteUrl } from "./seo";
import { eventSlug } from "./slugs";

/* Human-readable filter description for the digest header + subject.
   Returns null when the slice is "everything" so the caller can fall
   back to the generic copy. Order: regions > cities > tags > sources >
   types; one bucket each, joined with "·". Truncates to keep the
   subject sane. */
export function describeFilters(f: FilterState): string | null {
  const parts: string[] = [];
  if (f.regions.length) parts.push(f.regions.join(", "));
  if (f.cities.length) parts.push(f.cities.join(", "));
  if (f.tags.length) parts.push(f.tags.join(", "));
  if (f.sources.length) parts.push(f.sources.map((s) => sourceLabel(s)).join(", "));
  if (f.types.length) parts.push(f.types.map((t) => TYPE_LABELS[t]).join(", "));
  if (!parts.length) return null;
  const joined = parts.join(" · ");
  return joined.length > 80 ? `${joined.slice(0, 77)}…` : joined;
}

/* Weekly digest content builder. Plain text + HTML versions of the same
   message: subject line, header, ranked list of next 7 days of events,
   unsubscribe footer. Editorial design - keeps DM Serif italic for the
   header, IBM Plex Mono eyebrows, and the same stratum palette as the
   site, so the email visually echoes utahtechcalendar.com.

   Header colors are inlined hex (no @import or CSS custom properties)
   because Gmail strips <link> tags and Apple Mail only honors a subset
   of inline styles. */

const PAPER = "#FBF7EE";
const PAPER_DEEP = "#F2EBD9";
const INK = "#1B1B1B";
const INK_SOFT = "#6B6757";
const SUNSET_DEEP = "#B23A1F";
const DUSK_DEEP = "#3F4E5E";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

function fmtWindow(start: Date): string {
  return start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupByDay(events: EventWithGroup[]): Array<{ key: string; label: string; items: EventWithGroup[] }> {
  const buckets = new Map<string, { label: string; items: EventWithGroup[] }>();
  for (const e of events) {
    const start = new Date(e.startsAt);
    const key = start.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Denver",
    });
    const label = fmtDate(start);
    if (!buckets.has(key)) buckets.set(key, { label, items: [] });
    buckets.get(key)!.items.push(e);
  }
  return [...buckets.entries()].map(([key, v]) => ({ key, ...v }));
}

export interface BuildDigestInput {
  events: EventWithGroup[];
  unsubscribeUrl: string;
  weekStart: Date;
  weekEnd: Date;
  /* Optional human-readable filter slice e.g. "Salt Lake County · ai".
     Shows in the subject and as an eyebrow above the date range so a
     filtered subscriber sees their slice reflected in the email. */
  filterLabel?: string | null;
}

export interface DigestContent {
  subject: string;
  text: string;
  html: string;
}

export function buildDigest(input: BuildDigestInput): DigestContent {
  const { events, unsubscribeUrl, weekStart, weekEnd, filterLabel } = input;
  const range = `${fmtWindow(weekStart)} - ${fmtWindow(weekEnd)}`;
  const count = events.length;
  const subject = count === 0
    ? `Utah tech this week: a quiet one${filterLabel ? ` for ${filterLabel}` : ""} (${range})`
    : `${count} Utah tech event${count === 1 ? "" : "s"} this week${filterLabel ? ` (${filterLabel})` : ""}`;

  const days = groupByDay(events);

  // Plain text body
  const textLines: string[] = [
    "Utah Tech Calendar",
    range,
    "",
    count === 0
      ? "No in-person events this week. Schedule looks light - the full calendar lives at utahtechcalendar.com."
      : `${count} event${count === 1 ? "" : "s"} on deck.`,
    "",
  ];
  for (const day of days) {
    textLines.push(day.label.toUpperCase());
    for (const e of day.items) {
      const start = new Date(e.startsAt);
      const where = e.isOnline
        ? "online"
        : [e.venueName, e.city].filter(Boolean).join(", ") || "Utah";
      const url = absoluteUrl(`/event/${eventSlug(e.title, e.id)}`);
      textLines.push(`  ${fmtTime(start)} - ${e.title}`);
      textLines.push(`    ${where}`);
      textLines.push(`    ${url}`);
      textLines.push("");
    }
  }
  textLines.push("");
  textLines.push(`Full schedule: ${SITE_URL}`);
  textLines.push(`Unsubscribe: ${unsubscribeUrl}`);

  // HTML body
  const dayHtml = days.map((day) => `
    <tr>
      <td style="padding:28px 0 8px;border-top:1px solid ${INK}26;">
        <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${INK_SOFT};">${escapeHtml(day.label)}</span>
      </td>
    </tr>
    ${day.items.map((e) => {
      const start = new Date(e.startsAt);
      const url = absoluteUrl(`/event/${eventSlug(e.title, e.id)}`);
      const where = e.isOnline
        ? "Online"
        : [e.venueName, e.city].filter(Boolean).join(", ");
      const badgeBits: string[] = [];
      if (e.isConference) badgeBits.push(`<span style="display:inline-block;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${SUNSET_DEEP};margin-right:8px;">Conference</span>`);
      else if (e.isPaid) badgeBits.push(`<span style="display:inline-block;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${DUSK_DEEP};margin-right:8px;">Paid</span>`);
      const badges = badgeBits.join("");
      return `
      <tr>
        <td style="padding:12px 0 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
            <tr>
              <td style="vertical-align:top;padding-right:16px;width:80px;">
                <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_SOFT};">${escapeHtml(fmtTime(start))}</span>
              </td>
              <td style="vertical-align:top;">
                ${badges}
                <a href="${url}" style="font-family:Georgia,'DM Serif Display',serif;font-size:20px;line-height:1.25;color:${INK};text-decoration:none;font-style:italic;">${escapeHtml(e.title)}</a>
                <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:${INK_SOFT};">${escapeHtml(where || "")}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }).join("")}
  `).join("");

  const emptyState = `
    <tr>
      <td style="padding:32px 0;">
        <p style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:${INK_SOFT};margin:0;">
          No in-person events this week. Quiet stretch on the schedule.
        </p>
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:${INK_SOFT};margin:8px 0 0;">
          Hosting something? Submit it at <a href="${SITE_URL}/submit" style="color:${SUNSET_DEEP};">utahtechcalendar.com/submit</a>.
        </p>
      </td>
    </tr>`;

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
            <h1 style="margin:0;font-family:Georgia,'DM Serif Display',serif;font-style:italic;font-size:36px;line-height:1.1;color:${INK};letter-spacing:-0.01em;">This week in Utah tech.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;">
            <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};">${escapeHtml(range)}${filterLabel ? ` · ${escapeHtml(filterLabel)}` : ""}</span>
          </td>
        </tr>
        ${count === 0 ? emptyState : dayHtml}
        <tr>
          <td style="padding-top:40px;border-top:2px solid ${INK};">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:${INK_SOFT};margin:16px 0 0;">
              <a href="${SITE_URL}" style="color:${INK};text-decoration:underline;">Open the full schedule</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/submit" style="color:${INK};text-decoration:underline;">Submit an event</a>
            </p>
            <p style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${INK_SOFT};margin:24px 0 0;">
              <a href="${unsubscribeUrl}" style="color:${INK_SOFT};text-decoration:underline;">Unsubscribe</a>
            </p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:${INK_SOFT};margin:8px 0 0;">
              Sent because you asked. Every in-person Utah tech event we can find, in one place.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

export interface BuildVerifyEmailInput {
  email: string;
  verifyUrl: string;
}

export function buildVerifyEmail(input: BuildVerifyEmailInput): DigestContent {
  const subject = "Confirm your Utah Tech Calendar digest";
  const text = [
    "Hi,",
    "",
    `Confirm your weekly Utah Tech Calendar digest:`,
    input.verifyUrl,
    "",
    "If you didn't sign up, ignore this email.",
    "",
    "- Utah Tech Calendar",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;">
      <tr><td>
        <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT};">Utah Tech Calendar</span>
        <h1 style="margin:16px 0 12px;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;color:${INK};">One click to confirm.</h1>
        <p style="font-size:15px;line-height:1.6;color:${INK_SOFT};margin:0 0 24px;">Hit the button to start receiving the weekly digest of in-person Utah tech events. We'll only email once a week, Monday mornings.</p>
        <p style="margin:0 0 32px;"><a href="${input.verifyUrl}" style="display:inline-block;background:${INK};color:${PAPER};font-family:-apple-system,sans-serif;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:999px;">Confirm subscription</a></p>
        <p style="font-size:12px;color:${INK_SOFT};margin:0;">If the button doesn't work, paste this URL: <br/><a href="${input.verifyUrl}" style="color:${INK_SOFT};word-break:break-all;">${input.verifyUrl}</a></p>
        <p style="font-size:12px;color:${INK_SOFT};margin:24px 0 0;border-top:1px solid ${PAPER_DEEP};padding-top:16px;">Didn't sign up? Ignore this email - nothing happens until you click.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}
