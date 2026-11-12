# Scraper doctor notes (2026-11-12)

No code changes were made. Neither problem is a parser bug that an adapter edit could fix.

## Errored: BioUtah (htmlCalendar adapter)
- `https://bioutah.growthzoneapp.com/eventscalendar`
- `https://bioutah.growthzoneapp.com/communityeventscalendar`

Both return HTTP 403 on every run (100% over 56 runs in 7 days). The whole host
returns 403, including its root `https://bioutah.growthzoneapp.com/`, and it does
so for a separate independent fetcher as well, not just our scraper. This is
access blocking at the host level (WAF/bot protection, or the GrowthZone portal
was disabled or moved), not a change in page structure. Our request already sends
a normal browser User-Agent, Accept and Accept-Language (`src/lib/safe-fetch.ts`).
No header change could be shown to help, and getting around bot protection is out
of scope. The adapter was left unchanged.

**Maintainer action:** disable both sources, or find BioUtah's current public
events page (for example on bioutah.org) or an ICS feed and point the sources at
that instead.

## Drifted: luma adapter
- `https://lu.ma/utahcrypto`
- `https://luma.com/47g-hardtechweek`

Only 2 of the 5 Luma sources with history went to zero. The other 3 still
produce events, so the adapter's `__NEXT_DATA__` / ICS / detail parsing still
works and there is no change across all Luma sources. Both regressed calendar
pages load normally, but they show no upcoming events and "0 events pending
approval". `47g-hardtechweek` is a one-off event-week calendar whose week has
passed, and `utahcrypto` currently has nothing scheduled. Returning `[]` for
them is correct. The adapter was left unchanged.

**Maintainer action:** none needed for `utahcrypto` (it will pick events up again
when new ones are posted). Consider disabling `47g-hardtechweek` if that event
series is over.
