@AGENTS.md

# Utah Tech Calendar

The comprehensive calendar of in-person Utah tech events at `utahtechcalendar.com`. Scraped from Meetup, Luma, Eventbrite, plus manual submissions. Online events filtered out by default. (Repo / Vercel project slug stays `utah-tech-events` for continuity.)

## Stack
- Next.js 16 App Router, Tailwind v4, shadcn v4 (base-maia, hugeicons)
- Neon Postgres + Drizzle (`drizzle-orm/neon-http`)
- Bun, Vercel deploy
- Vercel Cron for scrapers, `CRON_SECRET` Bearer auth
- Resend for moderation magic-link emails
- Scraping logic lives in sibling repo `~/bnjmn/scraper-kit/` (consumed via `file:../scraper-kit` during dev)

## Commands
```bash
op run --env-file=.env.local -- bun run dev          # local dev with secrets resolved
op run --env-file=.env.local -- bun run db:push      # push schema to Neon
op run --env-file=.env.local -- bun run db:studio    # browse data
op run --env-file=.env.local -- bun scripts/one-shot-scrape.ts <adapter> <url>
```

## Key paths
- `src/lib/db/{index.ts,schema.ts}` — Neon + Drizzle setup
- `src/lib/regions.ts` — Utah region buckets, ported from utah-dev-events
- `src/lib/public-data.ts` - the one cached public dataset (all approved events, groups, enabled source count); `src/lib/public-events.ts` holds its pure filters; `src/lib/queries.ts` is the public read API on top; `src/lib/public-data-invalidate.ts` marks it stale after writes
- `src/lib/feeds/{ical,rss}.ts` — feed generators
- `src/app/api/cron/scrape/route.ts` — Vercel Cron entry, iterates `sources` table
- `vercel.json` — cron schedule

## Database wake rule
Neon suspends after 5 idle minutes, and every query wakes it. Public traffic (crawlers included) must not query the database.
- Public routes read through `src/lib/queries.ts` (or `src/lib/tag-events.ts`), never `src/lib/db`. `tests/public-routes-no-db.test.ts` enforces this; only admin, cron, email, submit, moderate, verify and unsubscribe routes may import the db.
- Anything that changes public data (events, groups, enabled sources) must mark the dataset stale through `src/lib/public-data-invalidate.ts`, also on its error path, since partial writes are already committed: `publicDataChanged()` in route handlers and server actions (admin actions wrap their writes in `changingPublicData()`), `publicDataChangedDuringRender()` in a page render. Both mark again 15 s later from `after()`, which replaces any refill that read the database before the write; that only holds because every refill is limited to 8 s (`src/lib/public-data-timing.ts`, `src/lib/refill-guard.ts`). Keep `RECHECK_DELAY_MS` above the refill limit, and leave a route at least 15 s of its `maxDuration` after the mark. Never `updateTag` or an `expire: 0` profile: a hard expire makes every regenerated page skip the data cache and query the database.
- Known limit, accepted by the owner on 2026-11-04: Next writes the cache entry after the refill returns, and nothing here bounds that write. If it ever finished after the delayed mark (more than `STORE_MARGIN_MS`, 7 s, after the refill returned), a refill that read before a change would count as fresh, and public pages would show the old data, a just-hidden event included. Only a mark that lands after that late write makes it stale again: normally the next scrape cron (every 3 h), or any other writer, or `GET /api/revalidate`; pages then update as traffic brings a successful refill. There is no guaranteed maximum: a cron can run late or fail (Vercel does not retry it), and a write can be slower than any later mark. Closing it needs a generation marker readable without the database (Vercel Global Config, formerly Edge Config). When a hidden event must be gone, call `GET /api/revalidate` after hiding it, then check the event's page and the lists it was on (load each twice: the first load can serve the stale copy while it regenerates); if it still shows, call it again and recheck.
- A script that writes production data can call `GET /api/revalidate` with the cron Bearer secret afterwards. Otherwise the next scrape cron (3 h) or the 6 h TTL picks the change up.
- `UTE_DB_QUERY_LOG=1` logs one `[db-query]` line per database request, to check what wakes the database. Each dataset refill logs `[public-data] refill ...`.
- Bump `PUBLIC_PAYLOAD_VERSION` when the payload shape changes. Query changes (fields, WHERE, ORDER) change the cache key on their own.
- A refill that fails, or returns after 8 s (encoding counts: the limit is checked again when the refill returns), stores nothing and pages keep serving the stale data. The first failure in a row is retried on the next read; after the second, the refill backs off (30 s doubling to 15 min, per guard copy: one per server bundle per instance). A failure more than 20 min after the previous one starts a new streak, so an old failure never arms a backoff for a refill that read before a write. Keep the first retry free: a backoff left by a refill that read before a write would let ISR pages regenerated after the delayed mark store the pre-write data (`src/lib/public-data-timing.ts` states the invariant, `tests/public-data-race.test.ts` checks it). With no cached entry at all (first deploy on an empty cache), a failing refill makes those pages error until the next try; the backoff still holds.
- The entry must stay under the 2 MB data cache limit. Every row is held to `FIELD_CAPS`; above 1.8 MB the refill drops past descriptions, then the oldest past events, then upcoming descriptions, a tenth at a time, and if that is still not enough it fails (stale data stays, backoff applies). It predicts which cut fits and checks it (usually 3 gzip passes, at most `MAX_ENCODE_PASSES`); each pass blocks the instance, so do not go back to trying every tenth in turn. Upcoming events and groups are never left out. /admin/health shows the size and what was cut; the health-alerts email warns above 1.5 MB, is urgent once anything is dropped, when the entry is over 9 h old, or when it cannot be read.
- The scrape and classify crons stop starting classification calls in time to keep 45 s / 30 s for the invalidation and its delayed mark (`src/lib/deadline.ts`); the rest waits for the next run.
- After each deploy of this code (including a roll-forward after a rollback), call `GET /api/revalidate` once so no entry written while other code was live is served.
- Where the entry lives on Vercel (checked 2026-11-02): `unstable_cache` entries go to the Data Cache, which Vercel is moving into Runtime Cache (no code change; Pro teams are told their date). Both are regional and shared by every instance in a region, survive deploys (`unstable_cache` keys carry no build id), have a 2 MB item limit, and honor `revalidateTag` (one timestamp per tag, checked against each entry's write time, spread to all regions within about 300 ms). Public functions run only in iad1, so there is one entry; adding function regions adds one entry and one refill per region. After the move, reads and writes bill in 8 KB units (iad1: $0.40 per million read units, $4.00 per million write units), so each read of a 0.36 MB entry is about 45 read units. Expect a burst of refills once when the team migrates (Vercel refills entries from live traffic).
- Post-deploy checks: `[public-data] refill` about twice per cron run (the second from the delayed mark) in the Vercel logs and no `[public-data]` errors; `x-vercel-cache` HIT or STALE on `/event/*`, `/city/*`, `/tag/*`, `/group/*`; the Neon endpoint suspended between crons; Vercel ISR read and write units and Data Cache or Runtime Cache reads and writes (Observability, Runtime Cache) within the plan, since each new public path (404s included) now stores an ISR entry and each dynamic request or regeneration reads the whole entry.
