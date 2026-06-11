# Contributing to Utah Tech Calendar

Thanks for helping make the Utah tech scene easier to find. This is a community resource and contributions are welcome — whether that's adding a source, writing a new adapter, improving filters, or just filing a good bug report.

## The smallest contribution: add a source

If your group, calendar, or org isn't listed, you usually don't need to write any code. Most sources are just a row in the `sources` table pointing an existing **adapter** at a **URL**.

You can:

- **Open a [New source request](../../issues/new/choose) issue** with the calendar URL and the platform (Meetup, Luma, Eventbrite, Substack, or a plain website), and a maintainer will wire it up, or
- **Submit it on the site** at [utahtechcalendar.com/submit](https://utahtechcalendar.com/submit) for a one-off event.

## Project layout

```
src/
  app/                  # Next.js App Router (pages, API routes, cron)
    api/cron/scrape/    # walks the sources table on a schedule
  components/           # UI, incl. filter-bar.tsx (filters) and event-card.tsx
  lib/
    db/schema.ts        # Drizzle schema: events, sources, groups, …
    scrapers/
      adapters/         # one file per source kind (meetup, luma, …)
      index.ts          # adapter registry
    filters.ts          # URL <-> filter state, the filter taxonomy
    regions.ts          # Utah region buckets, derived from city
    feeds/              # iCal + RSS generators
scripts/                # seed-sources, one-shot-scrape, etc.
```

## Local setup

Requires [Bun](https://bun.sh) and a Postgres database ([Neon](https://neon.tech) free tier works).

```bash
bun install
cp .env.local.example .env.local      # set DATABASE_URL at minimum
bun run db:push                       # apply the schema
bun scripts/seed-sources.ts           # populate sources
bun run dev                           # http://localhost:3000
```

Only `DATABASE_URL` is needed to run the UI and scrapers locally. `CRON_SECRET`, `MODERATION_SECRET`, and `RESEND_API_KEY` are only needed for the cron endpoints and email; Clerk vars are only for the `/admin` area.

### Use your own keys — never the project's

Contributors run against **their own** infrastructure, not the production project's:

- **Database**: your own free [Neon](https://neon.tech) project (or any Postgres). Never ask for the production `DATABASE_URL`.
- **Clerk** (`/admin` only): your own free Clerk dev instance with its own `pk_test`/`sk_test` keys.
- **Resend** (email only): your own test key, or just leave `RESEND_API_KEY` unset — submit/digest paths no-op without it.

Production secrets live only in the deploy platform's environment and are never shared, never committed, and never required to build or contribute. A pull request never needs them: the maintainers' deploy picks up the real values on merge.

Test a single adapter without waiting on cron:

```bash
bun scripts/one-shot-scrape.ts <adapter> <url>
# e.g. bun scripts/one-shot-scrape.ts meetup https://www.meetup.com/utah-js/
```

## Writing a new adapter

Add one when a source can't be expressed with an existing adapter (a new platform, or a site whose HTML the generic `htmlCalendar` adapter can't parse).

1. Create `src/lib/scrapers/adapters/<name>.ts` exporting an `Adapter<EventItem>` with a `scrape({ url })` that returns normalized `EventItem`s. Look at `meetup.ts` or `luma.ts` as templates.
2. Register it in `src/lib/scrapers/index.ts`.
3. Normalize to the shared `EventItem` shape (see `src/lib/scrapers/types.ts`) — title, `startsAt`, location, a stable `externalId`, and an `isOnline` flag. Online detection lives in `regions.ts`.
4. Test with `scripts/one-shot-scrape.ts` before opening a PR.

Keep adapters `fetch`-based where possible. Browser/headless sources (like Silicon Slopes) need a session cookie and are the exception, not the norm.

## Pull requests

- Branch off `main`, keep PRs focused.
- Run `bun run lint` and `bun run build` before pushing.
- **Never commit secrets.** Real values live outside the repo; `.env.local` is gitignored. A gitleaks check runs on commit — if it flags something, investigate rather than bypass.
- Describe what you changed and how you verified it. Screenshots help for UI changes.

## Reporting bugs

Use the [issue templates](../../issues/new/choose). For filter/scraper bugs, include the URL you were on (it encodes the filter state) and what you expected vs. saw.

## Code of conduct

Be kind and assume good faith. This exists to help people in the Utah tech community find each other.
