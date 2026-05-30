import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, sources, events } from "@/lib/db";
import {
  toggleSourceEnabled,
  toggleSourceRequiresReview,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

type SourceRow = typeof sources.$inferSelect;
type HealthStatus = "working" | "stale" | "broken" | "empty" | "disabled" | "never";

const STALE_MS = 24 * 60 * 60 * 1000;

/* Pulls the item count out of the runner's "ok: N items" lastStatus
   format. Returns null if the status string isn't ok-shaped, so a
   later format change reads as "unknown" rather than silently
   defaulting to "working". */
function parseOkItemCount(lastStatus: string | null): number | null {
  if (!lastStatus) return null;
  const trimmed = lastStatus.trim();
  if (!/^ok:/i.test(trimmed)) return null;
  const m = trimmed.match(/^ok:\s*(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

function classifySource(s: SourceRow): HealthStatus {
  if (!s.enabled) return "disabled";
  if (s.lastError) return "broken";
  if (!s.lastScrapedAt) return "never";
  const sinceMs = Date.now() - new Date(s.lastScrapedAt).getTime();
  if (sinceMs > STALE_MS) return "stale";
  const count = parseOkItemCount(s.lastStatus);
  if (count === 0) return "empty";
  return "working";
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  working: "working",
  stale: "stale",
  broken: "broken",
  empty: "empty",
  disabled: "disabled",
  never: "never scraped",
};

const STATUS_CHIP: Record<HealthStatus, string> = {
  working: "bg-sage/20 text-ink",
  stale: "bg-sunset/20 text-sunset-deep",
  broken: "bg-terracotta/25 text-terracotta-deep",
  empty: "bg-paper-deep text-ink-soft",
  disabled: "bg-ink/10 text-ink-soft",
  never: "bg-paper-deep text-ink-soft",
};

const FILTER_ORDER: ReadonlyArray<HealthStatus | "all"> = [
  "all",
  "working",
  "empty",
  "stale",
  "broken",
  "disabled",
  "never",
];

type SourcesSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SourcesAdminPage({
  searchParams,
}: {
  searchParams: SourcesSearchParams;
}) {
  const params = await searchParams;
  const rawFilter = Array.isArray(params.status) ? params.status[0] : params.status;
  const activeFilter: HealthStatus | "all" =
    rawFilter && FILTER_ORDER.includes(rawFilter as HealthStatus | "all")
      ? (rawFilter as HealthStatus | "all")
      : "all";

  const rows = await db.select().from(sources).orderBy(asc(sources.adapter), asc(sources.url));

  /* Per-source event counts (upcoming). Keyed by adapter source string. */
  const counts = await db.execute(sql`
    SELECT source, status, COUNT(*)::int as c
    FROM events
    WHERE starts_at >= now()
    GROUP BY source, status
  `);
  const countRows = (Array.isArray(counts) ? counts : (counts.rows ?? [])) as Array<{ source: string; status: string; c: number }>;
  const countMap = new Map<string, { approved: number; pending: number; hidden: number }>();
  for (const r of countRows) {
    const k = r.source;
    const existing = countMap.get(k) ?? { approved: 0, pending: 0, hidden: 0 };
    if (r.status === "approved") existing.approved = r.c;
    if (r.status === "pending") existing.pending = r.c;
    if (r.status === "hidden") existing.hidden = r.c;
    countMap.set(k, existing);
  }

  /* Health bucket counts for the subtab labels. */
  const bucketCounts = new Map<HealthStatus, number>();
  for (const s of rows) {
    const h = classifySource(s);
    bucketCounts.set(h, (bucketCounts.get(h) ?? 0) + 1);
  }

  const filtered = activeFilter === "all"
    ? rows
    : rows.filter((s) => classifySource(s) === activeFilter);

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-2">
        Ontology · Sources
      </p>
      <p className="text-sm text-ink-soft max-w-[60ch] text-pretty mb-6">
        Every scraper source the schedule runs against, grouped by health.
        Subtabs filter by status so broken or stale ones surface first. Click
        the URL to open the source in a new tab; toggle <em>enabled</em> or
        <em> requires review</em> in the right column.
      </p>

      {/* Subtab filter bar */}
      <nav
        aria-label="Filter sources by status"
        className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-6 pb-3 border-b border-ink/15 font-mono text-[10px] uppercase tracking-[0.18em]"
      >
        {FILTER_ORDER.map((f) => {
          const n = f === "all" ? rows.length : (bucketCounts.get(f) ?? 0);
          const isActive = activeFilter === f;
          const href = f === "all" ? "/admin/sources" : `/admin/sources?status=${f}`;
          return (
            <Link
              key={f}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "text-ink underline decoration-1 underline-offset-4"
                  : "text-ink-soft hover:text-ink transition-colors"
              }
            >
              {f === "all" ? "all" : STATUS_LABEL[f]} <span className="tabular-nums opacity-60">{n}</span>
            </Link>
          );
        })}
      </nav>

      <ul role="list" className="flex flex-col">
        {filtered.map((s) => {
          const c = countMap.get(s.adapter);
          const lastScraped = s.lastScrapedAt
            ? new Date(s.lastScrapedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            : "never";
          const health = classifySource(s);
          /* Cookie age - only meaningful for sources that have it set
             (Silicon Slopes). Warn at 50d, urgent at 80d. */
          const rotatedAt = s.authRotatedAt ? new Date(s.authRotatedAt) : null;
          const cookieDays = rotatedAt
            ? Math.round((Date.now() - rotatedAt.getTime()) / (24 * 60 * 60 * 1000))
            : null;
          const cookieChipClass =
            cookieDays !== null && cookieDays >= 80
              ? "bg-terracotta/25 text-terracotta-deep"
              : cookieDays !== null && cookieDays >= 50
                ? "bg-sunset/20 text-sunset-deep"
                : "bg-paper-deep text-ink-soft";
          return (
            <li
              key={s.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 py-5 border-t border-ink/15 first:border-t-0 items-baseline"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${STATUS_CHIP[health]}`}>
                    {STATUS_LABEL[health]}
                  </span>
                  {cookieDays !== null && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${cookieChipClass}`}>
                      cookie {cookieDays}d
                    </span>
                  )}
                  <span>{s.adapter}</span>
                  <span aria-hidden>·</span>
                  <span>last scraped {lastScraped}</span>
                  {s.lastStatus && (<><span aria-hidden>·</span><span>{s.lastStatus}</span></>)}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 font-display text-base text-ink hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors break-all"
                >
                  {s.url}
                </a>
                {s.lastError && (
                  <p className="mt-1 text-xs text-sunset-deep">{s.lastError.slice(0, 200)}</p>
                )}
                {c && (c.approved + c.pending + c.hidden) > 0 && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    {c.approved} upcoming approved
                    {c.pending > 0 && ` · ${c.pending} pending`}
                    {c.hidden > 0 && ` · ${c.hidden} hidden`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                <form action={toggleSourceEnabled.bind(null, s.id, !s.enabled)}>
                  <button
                    type="submit"
                    className={`py-1.5 sm:py-0 ${s.enabled ? "text-ink hover:text-sunset-deep hover:underline decoration-1 underline-offset-4" : "text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4"}`}
                  >
                    {s.enabled ? "enabled" : "disabled"}
                  </button>
                </form>
                <form action={toggleSourceRequiresReview.bind(null, s.id, !s.requiresReview)}>
                  <button
                    type="submit"
                    className={`py-1.5 sm:py-0 ${s.requiresReview ? "text-sunset-deep hover:underline decoration-1 underline-offset-4" : "text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4"}`}
                  >
                    {s.requiresReview ? "requires review" : "auto-approve"}
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-12 font-display text-lg italic text-ink-soft text-center">
          No sources match the {STATUS_LABEL[activeFilter as HealthStatus] ?? "current"} filter.
        </p>
      )}
    </div>
  );
}
