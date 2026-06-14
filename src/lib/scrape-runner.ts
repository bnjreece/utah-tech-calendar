import { sql, eq } from "drizzle-orm";
import { db, events, sources, groups, scrapeRuns } from "./db";
import { eventAdapters, type EventItem } from "./scrapers";
import { inferTagsFromTitle, isCertSpam, CERT_SPAM_STRIPPED_TAGS } from "./auto-tag";

export interface ScrapeResult {
  sourceId: string;
  adapter: string;
  url: string;
  status: "ok" | "error";
  inserted: number;
  updated: number;
  error?: string;
}

/* Heuristic - detect conferences from title keywords. Earlier version also
   used duration > 8h, but a 48h community hackathon is not a conference
   and the duration rule misclassified hackathons + multi-day workshops.
   Title keywords are noticeably high-precision; admin can still flag the
   rare miss manually via /admin (when that UI exists). */
const CONFERENCE_TITLE_RE =
  /\b(summit|conference|conf\b|expo|convention|congress|symposium)\b/i;
const CONFERENCE_FALSE_POSITIVE_RE =
  /\b(manifest|infest|fest meetup|summited|summiting|hackathon|jam\b)\b/i;

function detectConference(item: EventItem): boolean {
  if (CONFERENCE_FALSE_POSITIVE_RE.test(item.title)) return false;
  return CONFERENCE_TITLE_RE.test(item.title);
}

/* Detect paid events at scrape time. Conservative: only flag the
   obvious training/cert spam keywords - real paid conferences like
   KubeCon already get is_paid via the manual seed in research-dump
   commits. Avoids false positives on community events that mention
   "training" casually. */
const PAID_TITLE_RE =
  /\b(certification training|training program|exam prep|bootcamp|ccna|ccnp|ccie|cissp|capm|pmp|isc[²2]|ceh|comptia|isaca|itil|cpmai|caip|scrum master|prince2|safe agile|tableau certification|six sigma|black belt|green belt|pmi-acp)\b/i;
/* Mirror of NUMERIC_TRAINING_RE in lib/auto-tag.ts - kept in sync.
   Allowlist of cert-spam adjectives in the filler slot avoids
   misflagging titles like "30 Day Coding Challenge Workshop". */
const PAID_NUMERIC_TRAINING_RE =
  /\b\d+[\s-]*(?:days?|hours?|weeks?|sessions?|weekends?)\s+(?:(?:live|online|virtual|in[- ]person|hybrid|classroom|hands[- ]on|weekend|intensive|certified|confirmed|advanced|basic|beginner)\s+){0,3}(?:training|workshop|bootcamp|course)\b/i;

export function detectPaid(item: Pick<EventItem, "title">): boolean {
  return PAID_TITLE_RE.test(item.title) || PAID_NUMERIC_TRAINING_RE.test(item.title);
}

/* Pure-craft / makerspace events occasionally bleed in from sources we
   keep enabled for their tech content (slc-tech, utah-iot, etc.). The
   strongest signals are "Make & Take" workshop format and physical
   craft mediums. Conservative: only match clear craft keywords so a
   legitimate "Laser Cutter for IoT Enclosures" workshop still lands.
   New matches insert as status='hidden' so they're auditable without
   surfacing on the calendar. */
const CRAFT_REJECT_RE =
  /\b(make\s*(?:&|and)\s*take|woodturning|wood\s+turning|woodshop|lathe|sewing machine|cutting board|wood ring|knitting class|crochet class|quilting class|ceramics class|pottery class|jewelry making|soap making|candle making|makerspace tour)\b/i;

export function detectCraft(item: Pick<EventItem, "title">): boolean {
  return CRAFT_REJECT_RE.test(item.title);
}

/* Webinar / virtual-event detection. Many upstream adapters (HTML
   microdata, single-event Eventbrite, a few Luma calendars) don't
   carry eventAttendanceMode in their feed, so we infer from title +
   description. Hide-online-by-default on the home page would
   otherwise leak virtual events into the in-person schedule.

   Two layers:
   - Unambiguous tokens (webinar, livestream, online-only, remote-only)
     fire on their own.
   - Ambiguous tokens (virtual, zoom) require a co-occurring event noun
     in the title so "Virtual Reality Hackathon" and "Zoom Photography
     Workshop" don't get hidden. */
const ONLINE_STRONG_RE =
  /\b(webinar|live[- ]stream|livestream|online[- ]only|remote[- ]only)\b/i;
/* Bound the co-occurrence window to ~3 tokens on either side so the
   greedy `.*` from the prior version can't pair "Virtual" with a
   "Workshop Building" venue name 30 characters later. The narrower
   word list (`meetup|session|talk|panel|seminar|networking|happy
   hour`) drops `workshop`/`class`/`conference`/`event` - those are
   too common to anchor reliably without producing false hides on
   "Virtual Reality Hackathon at the Workshop Building" style
   titles. */
const ONLINE_AMBIGUOUS_RE =
  /\b(virtual|zoom)(?:\W+\w+){0,3}\W+(meetup|session|talk|panel|seminar|networking|happy hour)\b|\b(meetup|session|talk|panel|seminar|networking|happy hour)(?:\W+\w+){0,3}\W+(virtual|zoom)\b/i;
/* Venue/address-scoped online signal. A venue field is short and high-
   signal: if it literally names an online platform, the event is online
   even when the title is neutral ("Monthly AI Roundtable" whose venue is
   "Online (Zoom)"). Deliberately does NOT include "tbd" / "location
   unknown" - an undetermined location is not the same as an online event
   (that conflation was the silicon_slopes bug). */
const ONLINE_VENUE_RE =
  /\b(online|virtual|webinar|livestream|live[- ]stream|zoom|google meet|microsoft teams|ms teams)\b/i;
function detectOnline(item: EventItem): boolean {
  if (item.isOnline) return true;
  const t = item.title;
  if (ONLINE_STRONG_RE.test(t)) return true;
  if (ONLINE_AMBIGUOUS_RE.test(t)) return true;
  const venue = `${item.venueName ?? ""} ${item.address ?? ""}`.trim();
  if (venue && ONLINE_VENUE_RE.test(venue)) return true;
  const d = item.description;
  if (d && ONLINE_STRONG_RE.test(d)) return true;
  return false;
}

/* Extract the `defaultTags` field from a source's jsonb config column.
   Per-source tag injection covers the case where a vertical-specific
   source (Utah Crypto Luma, 47G aerospace calendar) produces events
   whose titles don't carry keyword anchors - title-only auto-tagging
   leaves them untagged, so the /tag/<vertical> landing page misses
   them. Source-injected tags are trusted unconditionally: they bypass
   the cert-spam STRONG_CONTENT_TAGS scrubber by being unioned in
   AFTER inference, not before. */
function sourceDefaultTags(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const v = (config as Record<string, unknown>).defaultTags;
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === "string" && t.length > 0);
}

async function upsertEvent(
  item: EventItem,
  groupId: string | undefined,
  sourceId: string,
  defaultStatus: string,
  injectedTags: string[],
) {
  const existing = await db
    .select({ id: events.id, groupLocked: events.groupLocked, onlineLocked: events.onlineLocked })
    .from(events)
    .where(sql`${events.source} = ${item.source} AND ${events.externalId} = ${item.externalId}`)
    .limit(1);

  /* If the scraper supplied tags, trust them. Otherwise infer from the
     title (and description if present) so /tag/[tag] landing pages have
     actual content. Then union with source-injected defaultTags so a
     "Utah Crypto" source row tags all its events with `fintech` even
     when the title says nothing crypto-flavored.

     Cert-spam scrubber applies to BOTH inferred AND injected: a
     `bioutah` row tagged `[biotech, healthtech]` ingesting a PMP cert-
     spam event would otherwise smuggle the strong content tag past
     the scrubber that exists to protect /tag/ai etc from spam. */
  const inferred =
    item.tags && item.tags.length > 0
      ? item.tags
      : inferTagsFromTitle(item.title, item.description);
  const haystack = `${item.title} ${item.description ?? ""}`;
  const certSpam = isCertSpam(haystack);
  const scrubbedInjected = certSpam
    ? injectedTags.filter((t) => !CERT_SPAM_STRIPPED_TAGS.has(t))
    : injectedTags;
  const tags =
    scrubbedInjected.length > 0
      ? Array.from(new Set([...inferred, ...scrubbedInjected]))
      : inferred;

  const baseValues = {
    title: item.title,
    description: item.description,
    link: item.link,
    source: item.source,
    externalId: item.externalId,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    isOnline: detectOnline(item),
    venueName: item.venueName,
    address: item.address,
    city: item.city,
    state: "UT",
    postalCode: item.postalCode,
    latitude: item.latitude?.toString(),
    longitude: item.longitude?.toString(),
    imageUrl: item.imageUrl,
    tags,
    groupId,
    sourceId,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    /* Don't overturn an admin's manual approve/reject on re-scrape, and
       don't overwrite is_conference/is_paid back to false if a heuristic
       missed but admin flagged. Likewise, if an admin manually set this
       event's group (groupLocked) or corrected its online flag
       (onlineLocked), leave those columns untouched. */
    const { groupId: nextGroupId, isOnline: nextIsOnline, ...rest } = baseValues;
    const setValues = {
      ...rest,
      ...(existing[0].groupLocked ? {} : { groupId: nextGroupId }),
      ...(existing[0].onlineLocked ? {} : { isOnline: nextIsOnline }),
    };
    await db.update(events).set(setValues).where(eq(events.id, existing[0].id));
    return "updated" as const;
  }
  const isConference = detectConference(item);
  const isCertSpamHit = detectPaid(item);
  const isCraft = detectCraft(item);
  /* Cert-spam and craft are TWO axes:
     - "hidden + hiddenReason" hides the event from the public schedule
     - is_paid is a content classification used by the "Free" type
       filter and the is_accessible_for_free JSON-LD signal
     Conflating them broke the /?types=paid filter (cert-spam hidden
     rows still had is_paid=true, so the paid filter returned zero
     rows alongside the actual paid conferences). Now cert-spam hits
     hide the row WITHOUT setting is_paid - the row is junk, not a
     "paid event". Real paid conferences still get is_paid=true via
     the manual seed in research-dump commits. */
  const status = isCraft || isCertSpamHit ? "hidden" : defaultStatus;
  const hiddenReason = isCraft
    ? "craft"
    : isCertSpamHit
      ? "cert-spam"
      : null;
  const isPaid = false;
  /* Deliberate ledger scope boundary: insert-time heuristic hides (craft /
     cert-spam) are NOT written to review_decisions. They are born-hidden and
     never surfaced, so they aren't a "decision that changed a visible
     event's state" the way an admin hide or the dedup sweep is. The
     heuristic's original call is still recoverable for the funnel - it is
     frozen into snapshot.flags.hiddenReason if/when a human later restores
     the row. The ledger records human decisions + post-hoc auto sweeps. */
  await db.insert(events).values({
    ...baseValues,
    status,
    hiddenReason,
    isConference,
    isPaid,
  });
  return "inserted" as const;
}

/* Record one scrape attempt into scrape_runs. Best-effort - a failed
   history insert shouldn't change the scrape outcome the caller sees. */
async function recordRun(
  sourceId: string,
  adapter: string,
  startedAt: Date,
  durationMs: number,
  status: "ok" | "error",
  itemCount: number,
  inserted: number,
  updated: number,
  error: string | null,
): Promise<void> {
  try {
    await db.insert(scrapeRuns).values({
      sourceId,
      adapter,
      startedAt,
      durationMs,
      status,
      itemCount,
      inserted,
      updated,
      error: error?.slice(0, 500) ?? null,
    });
  } catch (err) {
    console.warn("[scrape] run-history insert failed", err);
  }
}

export async function runSourceScrape(sourceId: string): Promise<ScrapeResult> {
  const startedAt = new Date();
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);

  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);

  if (!source) {
    throw new Error(`source ${sourceId} not found`);
  }

  const adapter = eventAdapters[source.adapter];
  if (!adapter) {
    const err = `unknown adapter: ${source.adapter}`;
    await db
      .update(sources)
      .set({ lastScrapedAt: new Date(), lastStatus: "error", lastError: err })
      .where(eq(sources.id, sourceId));
    await recordRun(sourceId, source.adapter, startedAt, elapsed(), "error", 0, 0, 0, err);
    return { sourceId, adapter: source.adapter, url: source.url, status: "error", inserted: 0, updated: 0, error: err };
  }

  let groupId: string | undefined = source.groupId ?? undefined;
  const injectedTags = sourceDefaultTags(source.config);

  try {
    const items = await adapter.scrape({
      url: source.url,
      maxItems: 30,
      sourceConfig: source.config ?? undefined,
    });
    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      if (!groupId && item.groupExternalId && item.groupName) {
        const [g] = await db
          .select({ id: groups.id })
          .from(groups)
          .where(sql`${groups.source} = ${item.source} AND ${groups.externalId} = ${item.groupExternalId}`)
          .limit(1);
        if (g) groupId = g.id;
      }

      const defaultStatus = source.requiresReview ? "pending" : "approved";
      const outcome = await upsertEvent(item, groupId, source.id, defaultStatus, injectedTags);
      if (outcome === "inserted") inserted++;
      else updated++;
    }

    await db
      .update(sources)
      .set({
        lastScrapedAt: new Date(),
        lastStatus: `ok: ${items.length} items`,
        lastError: null,
      })
      .where(eq(sources.id, sourceId));

    await recordRun(sourceId, source.adapter, startedAt, elapsed(), "ok", items.length, inserted, updated, null);
    return { sourceId, adapter: source.adapter, url: source.url, status: "ok", inserted, updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(sources)
      .set({ lastScrapedAt: new Date(), lastStatus: "error", lastError: msg })
      .where(eq(sources.id, sourceId));
    await recordRun(sourceId, source.adapter, startedAt, elapsed(), "error", 0, 0, 0, msg);
    return { sourceId, adapter: source.adapter, url: source.url, status: "error", inserted: 0, updated: 0, error: msg };
  }
}

/* Global ceiling on concurrent scrapes across all hosts. Bounds
   function memory + CPU. With fetch-based adapters each scrape is
   light, so this can be generous. */
const GLOBAL_CONCURRENCY = 8;

/* Max concurrent requests to a SINGLE host. The bot-detection concern
   is bursts of MANY simultaneous requests from one IP, not a steady
   3-at-a-time - that's normal calendar-aggregator behavior and well
   under any real rate limit. Meetup (33 sources) + Eventbrite (11)
   are the only hosts this binds; the rest have 1-2 sources each.
   At 3/host the Meetup lane finishes in ~11 batches instead of 33
   serial steps. */
const PER_HOST_CONCURRENCY = 3;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown-host";
  }
}

/* Bounded scheduler with BOTH a global cap and a per-host cap. Workers
   pull the next source whose host isn't already at PER_HOST_CONCURRENCY;
   if every remaining source is host-blocked, the worker yields a tick
   and retries. The global cap is enforced by the number of workers
   (GLOBAL_CONCURRENCY of them). This is the politeness layer: no single
   host ever sees more than PER_HOST_CONCURRENCY in-flight requests. */
async function runHostLimited(
  items: Array<{ id: string; host: string }>,
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  const inFlightByHost = new Map<string, number>();
  const pending = [...items];

  async function worker(): Promise<void> {
    while (true) {
      /* Find the next source whose host has a free slot. */
      let pickedIdx = -1;
      for (let i = 0; i < pending.length; i++) {
        const h = pending[i].host;
        if ((inFlightByHost.get(h) ?? 0) < PER_HOST_CONCURRENCY) {
          pickedIdx = i;
          break;
        }
      }
      if (pickedIdx === -1) {
        /* Everything left is host-blocked. If nothing is in flight we
           are done; otherwise yield and let an in-flight scrape free a
           host slot. */
        if (pending.length === 0) return;
        const anyInFlight = [...inFlightByHost.values()].some((n) => n > 0);
        if (!anyInFlight) return;
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      const [item] = pending.splice(pickedIdx, 1);
      inFlightByHost.set(item.host, (inFlightByHost.get(item.host) ?? 0) + 1);
      try {
        /* runSourceScrape catches its own errors + persists them to
           sources.last_error + scrape_runs, so one bad adapter can't
           take down the sweep. */
        const res = await runSourceScrape(item.id);
        results.push(res);
      } finally {
        inFlightByHost.set(item.host, (inFlightByHost.get(item.host) ?? 1) - 1);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(GLOBAL_CONCURRENCY, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function runAllEnabledSources(): Promise<ScrapeResult[]> {
  const rows = await db
    .select({ id: sources.id, url: sources.url })
    .from(sources)
    .where(eq(sources.enabled, true));

  const items = rows.map((r) => ({ id: r.id, host: hostOf(r.url) }));
  const results = await runHostLimited(items);

  // After all sources, sweep cross-posted SEO-spam clusters (e.g. one
  // training listing per city). Hides non-canonical members; idempotent.
  const { sweepCrossPostDuplicates } = await import("./dedup-sweep");
  await sweepCrossPostDuplicates();

  // Prune scrape_runs older than 30 days so the history table stays
  // small. Best-effort; a failed prune doesn't affect the scrape.
  try {
    await db.delete(scrapeRuns).where(
      sql`${scrapeRuns.startedAt} < now() - interval '30 days'`,
    );
  } catch (err) {
    console.warn("[scrape] run-history prune failed", err);
  }

  return results;
}
