import { db, adminSettings } from "@/lib/db";
import { saveAdminSettings } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · Admin" };

async function loadSettings() {
  const [row] = await db.select().from(adminSettings).limit(1);
  return (
    row ?? {
      alertEmail: "",
      notifySourceErrors: true,
      notifySourceStale: true,
      notifyCookieExpiry: true,
      staleThresholdHours: 24,
      lastAlertsSentAt: null,
      lastQueueDigestRunAt: null,
      lastScrapeTickAt: null,
    }
  );
}

function fmtRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min ago`;
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function NotificationsPage() {
  const s = await loadSettings();

  async function action(formData: FormData) {
    "use server";
    await saveAdminSettings({
      alertEmail: String(formData.get("alertEmail") ?? ""),
      notifySourceErrors: formData.get("notifySourceErrors") === "on",
      notifySourceStale: formData.get("notifySourceStale") === "on",
      notifyCookieExpiry: formData.get("notifyCookieExpiry") === "on",
      staleThresholdHours: Number(formData.get("staleThresholdHours") ?? 24),
    });
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl italic tracking-tight">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Daily alert email when something is wrong with the scrapers.
          Runs at 14:00 UTC (8am MDT / 7am MST) and only sends when the
          alert set has changed since the last send.
        </p>
      </header>

      <form action={action} className="flex flex-col gap-7">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Alert email
          </span>
          <input
            name="alertEmail"
            type="email"
            defaultValue={s.alertEmail ?? ""}
            placeholder="b@bnjmn.org"
            className="rounded-md border border-ink/20 bg-paper px-3 py-2 text-base focus:border-ink outline-none"
          />
          <span className="text-xs text-ink-soft">
            Leave blank to disable all alert emails.
          </span>
        </label>

        <fieldset className="flex flex-col gap-3 border-t border-ink/15 pt-6">
          <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-2 px-0">
            Categories
          </legend>
          <ToggleRow
            name="notifySourceErrors"
            defaultChecked={s.notifySourceErrors}
            label="Source errored"
            description="A scraper threw or persisted a lastError. Surfaces the source URL and the first 200 chars of the error."
          />
          <ToggleRow
            name="notifySourceStale"
            defaultChecked={s.notifySourceStale}
            label="Source stale"
            description="An enabled source hasn't scraped within the stale threshold. Also catches the 'cron stopped firing' case."
          />
          <ToggleRow
            name="notifyCookieExpiry"
            defaultChecked={s.notifyCookieExpiry}
            label="Cookie expiry"
            description="Silicon Slopes (and any future session-auth source) warning at 50 days old, urgent at 80, plus the runtime 401/403 detection."
          />
        </fieldset>

        <label className="flex flex-col gap-2 border-t border-ink/15 pt-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Stale threshold (hours)
          </span>
          <input
            name="staleThresholdHours"
            type="number"
            min={1}
            max={168}
            step={1}
            defaultValue={s.staleThresholdHours}
            className="rounded-md border border-ink/20 bg-paper px-3 py-2 text-base focus:border-ink outline-none w-32"
          />
          <span className="text-xs text-ink-soft">
            Default 24h. The scrape cron runs every 3h, so 12-24h is the
            useful range. Higher = fewer false positives during transient
            failures.
          </span>
        </label>

        <dl className="border-t border-ink/15 pt-6 grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          <dt>Last source-health email</dt>
          <dd className="tabular-nums">
            {s.lastAlertsSentAt
              ? `${fmtRelative(new Date(s.lastAlertsSentAt))} · ${new Date(s.lastAlertsSentAt).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "never"}
          </dd>
          <dt>Last queue-digest cron run</dt>
          <dd className="tabular-nums">
            {s.lastQueueDigestRunAt
              ? `${fmtRelative(new Date(s.lastQueueDigestRunAt))} · ${new Date(s.lastQueueDigestRunAt).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "not yet · fires daily 13:30 UTC"}
          </dd>
          <dt>Last scrape tick</dt>
          <dd className="tabular-nums">
            {s.lastScrapeTickAt
              ? `${fmtRelative(new Date(s.lastScrapeTickAt))} · ${new Date(s.lastScrapeTickAt).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "never"}
          </dd>
        </dl>

        <button
          type="submit"
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
        >
          Save
        </button>
      </form>
    </div>
  );
}

function ToggleRow({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 accent-ink"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-soft mt-0.5 leading-relaxed">
          {description}
        </span>
      </span>
    </label>
  );
}
