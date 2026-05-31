import { sql, eq } from "drizzle-orm";
import { db, events, sources, groups } from "./db";
import { eventAdapters, type EventItem } from "./scrapers";
import { inferTagsFromTitle } from "./auto-tag";

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
  /\b(certification training|training program|exam prep|bootcamp|cissp|capm|pmp|isc²|ceh|comptia|isaca|itil)\b/i;

function detectPaid(item: EventItem): boolean {
  return PAID_TITLE_RE.test(item.title);
}

async function upsertEvent(item: EventItem, groupId: string | undefined, defaultStatus: string = "approved") {
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(sql`${events.source} = ${item.source} AND ${events.externalId} = ${item.externalId}`)
    .limit(1);

  /* If the scraper supplied tags, trust them. Otherwise infer from the
     title (and description if present) so /tag/[tag] landing pages have
     actual content. */
  const tags =
    item.tags && item.tags.length > 0
      ? item.tags
      : inferTagsFromTitle(item.title, item.description);

  const baseValues = {
    title: item.title,
    description: item.description,
    link: item.link,
    source: item.source,
    externalId: item.externalId,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    isOnline: item.isOnline,
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
    updatedAt: new Date(),
  };

  if (existing[0]) {
    /* Don't overturn an admin's manual approve/reject on re-scrape, and
       don't overwrite is_conference/is_paid back to false if a heuristic
       missed but admin flagged. */
    await db.update(events).set(baseValues).where(eq(events.id, existing[0].id));
    return "updated" as const;
  }
  const isConference = detectConference(item);
  const isPaid = detectPaid(item);
  await db.insert(events).values({
    ...baseValues,
    status: defaultStatus,
    isConference,
    isPaid,
  });
  return "inserted" as const;
}

export async function runSourceScrape(sourceId: string): Promise<ScrapeResult> {
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
    return { sourceId, adapter: source.adapter, url: source.url, status: "error", inserted: 0, updated: 0, error: err };
  }

  let groupId: string | undefined = source.groupId ?? undefined;

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
      const outcome = await upsertEvent(item, groupId, defaultStatus);
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

    return { sourceId, adapter: source.adapter, url: source.url, status: "ok", inserted, updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(sources)
      .set({ lastScrapedAt: new Date(), lastStatus: "error", lastError: msg })
      .where(eq(sources.id, sourceId));
    return { sourceId, adapter: source.adapter, url: source.url, status: "error", inserted: 0, updated: 0, error: msg };
  }
}

export async function runAllEnabledSources(): Promise<ScrapeResult[]> {
  const rows = await db.select({ id: sources.id }).from(sources).where(eq(sources.enabled, true));
  const results: ScrapeResult[] = [];
  for (const r of rows) {
    results.push(await runSourceScrape(r.id));
  }
  // After all sources, sweep cross-posted SEO-spam clusters (e.g. one
  // training listing per city). Hides non-canonical members; idempotent.
  const { sweepCrossPostDuplicates } = await import("./dedup-sweep");
  await sweepCrossPostDuplicates();
  return results;
}
