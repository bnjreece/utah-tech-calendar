import type { sources, AdminSettings } from "./db";

/* Shared source-health alert detection. Powers the /admin overview
   page (always shown) and the daily /api/cron/health-alerts email
   (gated on admin_settings toggles). Logic is the single source of
   truth so the UI and the email never disagree about what's broken. */

export type SourceRow = typeof sources.$inferSelect;

export type AlertCategory = "cookie_expiry" | "source_error" | "source_stale";

export interface SourceAlert {
  level: "urgent" | "warn";
  title: string;
  body: string;
  action?: string;
  category: AlertCategory;
  /* Stable identifier for hash-based dedup in the daily email - lets
     us avoid resending the exact same set of alerts the next morning
     when nothing changed. */
  key: string;
}

const ZERO_ITEMS = /^ok: 0 items$/i;
const SS_COOKIE_EXPIRED_RE = /session cookie likely expired/i;

export interface DetectAlertsOptions {
  /* When null/undefined we use defaults that match the previous /admin
     hard-coded behavior (24h stale, all categories enabled). The cron
     passes the AdminSettings row to honor the user's toggles. */
  settings?: AdminSettings | null;
}

export function detectAlerts(
  sourceRows: SourceRow[],
  opts: DetectAlertsOptions = {},
): SourceAlert[] {
  const alerts: SourceAlert[] = [];
  const now = Date.now();
  const staleThresholdHours = opts.settings?.staleThresholdHours ?? 24;
  const STALE_MS = staleThresholdHours * 60 * 60 * 1000;
  const wantErrors = opts.settings?.notifySourceErrors ?? true;
  const wantStale = opts.settings?.notifySourceStale ?? true;
  const wantCookie = opts.settings?.notifyCookieExpiry ?? true;
  const enabled = sourceRows.filter((s) => s.enabled);
  const staleEnabled: SourceRow[] = [];

  for (const s of enabled) {
    /* Silicon Slopes cookie expired. */
    const ssZero =
      s.adapter === "siliconSlopes" &&
      ZERO_ITEMS.test((s.lastStatus ?? "").trim());
    const ssAuthErr =
      s.adapter === "siliconSlopes" &&
      SS_COOKIE_EXPIRED_RE.test(s.lastError ?? "");
    if ((ssZero || ssAuthErr) && wantCookie) {
      const lastScrapedLabel = s.lastScrapedAt
        ? new Date(s.lastScrapedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Denver",
          })
        : "never";
      alerts.push({
        level: "urgent",
        title: "Silicon Slopes cookie expired",
        body: `Last scrape: ${lastScrapedLabel}. ${ssAuthErr ? "Circle API rejected the session cookie." : "Scraper returned 0 events - likely cookie expiry."}`,
        action:
          "Sign in at siliconslopes.com, then ask Claude to rotate the cookie.",
        category: "cookie_expiry",
        key: `cookie_expiry:${s.id}`,
      });
      continue;
    }

    /* Preemptive cookie-age alert for sources that track rotation. */
    if (s.authRotatedAt && wantCookie) {
      const days = Math.round(
        (now - new Date(s.authRotatedAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days >= 80) {
        alerts.push({
          level: "urgent",
          title: `${s.adapter} session cookie is ${days} days old`,
          body: "Cookie is past the typical 60-90d expiry window. Rotate before the next scrape returns 0 events.",
          action: "Sign in at the source, then ask Claude to rotate the cookie.",
          category: "cookie_expiry",
          key: `cookie_age_urgent:${s.id}`,
        });
        continue;
      }
      if (days >= 50) {
        alerts.push({
          level: "warn",
          title: `${s.adapter} session cookie is ${days} days old`,
          body: "Approaching the typical expiry window. Plan to rotate in the next few weeks.",
          category: "cookie_expiry",
          key: `cookie_age_warn:${s.id}`,
        });
        continue;
      }
    }

    /* Any source persisted an error. */
    if (s.lastError && wantErrors) {
      alerts.push({
        level: "urgent",
        title: `${s.adapter} scraper errored`,
        body: `${s.url} · ${s.lastError.slice(0, 200)}`,
        category: "source_error",
        key: `error:${s.id}`,
      });
      continue;
    }

    /* Stale check - skipped entirely for the recurrence adapter because
       it never fetches; if the runner ran it, lastScrapedAt is fresh.
       (A genuinely stale recurrence row means the cron itself stopped,
       which the meta-alert below catches.) */
    if (!wantStale) continue;
    const lastRunMs = s.lastScrapedAt ? new Date(s.lastScrapedAt).getTime() : null;
    if (lastRunMs === null || now - lastRunMs > STALE_MS) {
      staleEnabled.push(s);
    }
  }

  /* Meta-alert when most sources are stale - cron likely stopped. */
  if (wantStale && staleEnabled.length > 0 && staleEnabled.length >= enabled.length - 2) {
    alerts.push({
      level: "urgent",
      title: `Cron may have stopped firing - ${staleEnabled.length} of ${enabled.length} sources stale`,
      body: `All or nearly all enabled sources have not scraped in over ${staleThresholdHours}h. Check Vercel Functions logs and the cron schedule.`,
      category: "source_stale",
      key: "cron_dead",
    });
  } else if (wantStale) {
    for (const s of staleEnabled.slice(0, 5)) {
      const hours = s.lastScrapedAt
        ? Math.round((now - new Date(s.lastScrapedAt).getTime()) / (60 * 60 * 1000))
        : null;
      alerts.push({
        level: "warn",
        title:
          hours === null
            ? `${s.adapter} source never scraped`
            : `${s.adapter} source stale (${hours}h since last scrape)`,
        body: s.url,
        category: "source_stale",
        key: `stale:${s.id}`,
      });
    }
    if (staleEnabled.length > 5) {
      alerts.push({
        level: "warn",
        title: `+${staleEnabled.length - 5} more stale sources`,
        body: "Open Sources to triage.",
        category: "source_stale",
        key: "stale_overflow",
      });
    }
  }

  return alerts;
}

/* Stable hash of the current alert set so the cron only re-emails when
   the situation actually changed. Two alert lists with the same set of
   `key`s produce the same hash regardless of order. */
export function hashAlerts(alerts: SourceAlert[]): string {
  const keys = alerts.map((a) => a.key).sort().join("|");
  let h = 5381;
  for (let i = 0; i < keys.length; i++) {
    h = ((h << 5) + h + keys.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
