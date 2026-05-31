import type { sources, AdminSettings } from "./db";

/* Shared source-health alert detection. Powers the /admin overview
   page (always shown) and the daily /api/cron/health-alerts email
   (gated on admin_settings toggles). Logic is the single source of
   truth so the UI and the email never disagree about what's broken. */

export type SourceRow = typeof sources.$inferSelect;

export type AlertCategory = "cookie_expiry" | "source_error" | "source_stale" | "cron_down";

/* Sources newer than this are excluded from the "never scraped" alert.
   They legitimately haven't had a cron tick yet; firing on them creates
   noise every time we add new sources. */
const NEW_SOURCE_GRACE_MS = 24 * 60 * 60 * 1000;
/* The scrape cron runs every 3h. If the heartbeat is older than this
   limit (~2× cron interval), the cron has stopped firing even if
   individual sources still look fresh. */
const CRON_HEARTBEAT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

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
  /* Heartbeat check - independent of any individual source. Surfaces
     fastest when Vercel cron quietly stops.

     Corroborate the stale heartbeat against "did any source scrape
     recently?" before firing - protects against the false positive
     where a transient Neon error swallowed the heartbeat write but
     the scrape itself ran fine. If at least one source has a fresh
     lastScrapedAt, the cron clearly fired; suppress the alert. */
  if (opts.settings?.lastScrapeTickAt) {
    const lastTick = new Date(opts.settings.lastScrapeTickAt).getTime();
    const ageH = Math.round((now - lastTick) / (60 * 60 * 1000));
    const anyFresh = sourceRows.some(
      (s) =>
        s.lastScrapedAt &&
        now - new Date(s.lastScrapedAt).getTime() < CRON_HEARTBEAT_MAX_AGE_MS,
    );
    if (now - lastTick > CRON_HEARTBEAT_MAX_AGE_MS && !anyFresh) {
      alerts.push({
        level: "urgent",
        title: `Scrape cron heartbeat is ${ageH}h old`,
        body: "The cron stamps lastScrapeTickAt at the start of every run, and no source has a fresh lastScrapedAt either. Check Vercel Functions logs and the cron schedule.",
        category: "cron_down",
        key: "cron_heartbeat",
      });
    }
  }
  const STALE_MS = staleThresholdHours * 60 * 60 * 1000;
  const wantErrors = opts.settings?.notifySourceErrors ?? true;
  const wantStale = opts.settings?.notifySourceStale ?? true;
  const wantCookie = opts.settings?.notifyCookieExpiry ?? true;
  const enabled = sourceRows.filter((s) => s.enabled);
  /* "Eligible" for stale tracking = enabled AND past the 24h
     new-source grace. Used by the meta-alert math so a flurry of newly
     added sources doesn't mask a real cron-down situation. */
  const eligibleForStale = enabled.filter((s) => {
    const createdAtMs = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    return !createdAtMs || now - createdAtMs >= NEW_SOURCE_GRACE_MS;
  });
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
    /* Skip recently-added sources - they legitimately haven't had a
       cron tick yet. Without this every new seed shows up as
       "never scraped" the same minute it's added. */
    const createdAtMs = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    if (createdAtMs && now - createdAtMs < NEW_SOURCE_GRACE_MS) continue;
    const lastRunMs = s.lastScrapedAt ? new Date(s.lastScrapedAt).getTime() : null;
    if (lastRunMs === null || now - lastRunMs > STALE_MS) {
      staleEnabled.push(s);
    }
  }

  /* Meta-alert when most ELIGIBLE sources are stale - cron likely
     stopped. Compared against eligibleForStale (not raw enabled) so a
     recent batch of new sources can't artificially keep us below the
     "almost everyone is stale" threshold. */
  if (
    wantStale &&
    staleEnabled.length > 0 &&
    eligibleForStale.length > 0 &&
    staleEnabled.length >= eligibleForStale.length - 2
  ) {
    alerts.push({
      level: "urgent",
      title: `Cron may have stopped firing - ${staleEnabled.length} of ${eligibleForStale.length} eligible sources stale`,
      body: `All or nearly all enabled sources (past the 24h grace) have not scraped in over ${staleThresholdHours}h. Check Vercel Functions logs and the cron schedule.`,
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
