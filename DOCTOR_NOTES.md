# Scraper doctor notes — 2026-11-19

## Summary
No code changes made. Nothing in the inputs is fixable by an adapter edit.

## Errored sources (broken-sources.json)

| Source id | URL | Error |
|---|---|---|
| a32efa7b-f670-4834-b5a4-78b05eefe781 | https://bioutah.growthzoneapp.com/eventscalendar | HTTP 403 |
| d5b43dd4-7d2d-420b-a813-4d0464fdf353 | https://bioutah.growthzoneapp.com/communityeventscalendar | HTTP 403 |

Adapter: `htmlCalendar` (`src/lib/scrapers/adapters/html-calendar.ts`), fetching via
`fetchHtml` → `safeFetchHtml`.

Diagnosis: the failure happens in the fetch, before any parsing. GrowthZone answers
`403 Forbidden` on both calendar pages for every run (100% of 56 runs over 7 days).
This looks like host-level access blocking (a WAF or bot protection that rejects our
server or datacenter IP or request), not a markup change. The JSON-LD and microdata
parsing never runs, so changing selectors or JSON paths would not help. Getting past
the block would mean evading bot detection or routing around `safeFetchHtml`. Both
are out of scope and not allowed here, so I left the code unchanged.

Not verified: I did not fetch the live pages (no shell commands in this run).

Suggested maintainer actions:
- Disable both sources for now. They will keep failing every run.
- Check whether BioUtah publishes the same events somewhere we can fetch, such as an
  iCal export, a calendar on bioutah.org, or Eventbrite or Luma listings, and add that
  as a new source.
- Or ask BioUtah or GrowthZone to allowlist the scraper.

## Drifted adapters (drifted-adapters.json)
None listed (empty array). Nothing to do.
