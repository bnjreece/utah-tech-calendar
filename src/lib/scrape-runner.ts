import { sql, eq } from "drizzle-orm";
import { db, events, sources, groups } from "./db";
import { categorizeRegion } from "./regions";
import { eventAdapters, type EventItem } from "./scrapers";

export interface ScrapeResult {
  sourceId: string;
  adapter: string;
  url: string;
  status: "ok" | "error";
  inserted: number;
  updated: number;
  error?: string;
}

async function upsertEvent(item: EventItem, groupId: string | undefined) {
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(sql`${events.source} = ${item.source} AND ${events.externalId} = ${item.externalId}`)
    .limit(1);

  const region = categorizeRegion({
    city: item.city,
    venueName: item.venueName,
    address: item.address,
  });
  void region;

  const values = {
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
    tags: item.tags,
    groupId,
    status: "approved",
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db.update(events).set(values).where(eq(events.id, existing[0].id));
    return "updated" as const;
  }
  await db.insert(events).values(values);
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
    const items = await adapter.scrape({ url: source.url, maxItems: 30 });
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

      const outcome = await upsertEvent(item, groupId);
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
