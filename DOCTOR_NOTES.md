# Scraper doctor notes — 2026-10-15

## Errored sources

### saintcon.org (`https://saintcon.org/`, adapter: `htmlCalendar`)
- **lastError:** `The operation was aborted due to timeout`
- **Error rate:** 2 of 56 runs in the last 7 days. The other 54 succeeded, so the parser is fine and nothing structural changed. The site is just sometimes slower than the 15s default `safeFetchHtml` timeout.
- **Fix:** `src/lib/scrapers/adapters/html-calendar.ts` now calls `fetchHtml(url, { timeoutMs: 30_000 })`, the same 30s budget that `silicon-slopes` and `eventbrite` already use. The fetch still goes through `fetchHtml` → `safeFetchHtml`, so the SSRF checks, redirect re-validation and 2 MB size cap are unchanged.
- **Trade-off:** this applies to every `htmlCalendar` source, so a hung host can now hold a scrape slot for up to 30s instead of 15s. The scrape cron has a 300s `maxDuration` and runs 8 at a time, so there is plenty of room.
- **Maintainer action:** none needed. If timeouts keep happening at a high rate after this change, the host is probably rate-limiting or blocking us, and it would be worth looking at more closely.

## Drifted adapters

`drifted-adapters.json` was empty, so no adapters needed drift fixes.

## Not verified
Per the task rules, I made no live fetches and ran no tests or type-check. The change is a one-argument edit using an existing `fetchHtml` option.
