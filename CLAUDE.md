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
- `src/lib/feeds/{ical,rss}.ts` — feed generators
- `src/app/api/cron/scrape/route.ts` — Vercel Cron entry, iterates `sources` table
- `vercel.json` — cron schedule

## Plan
See `/Users/bnjmn/.claude/plans/glowing-waddling-hummingbird.md` for the full build plan.
