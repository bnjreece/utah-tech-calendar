# Scraper doctor notes — 2026-10-29

## Summary
No code changes. Both broken sources are being blocked upstream (HTTP 403).
That isn't a parser bug, so editing the adapter won't fix it.

## Errored sources

### bioutah.growthzoneapp.com (2 sources, htmlCalendar adapter)
- `https://bioutah.growthzoneapp.com/eventscalendar`
- `https://bioutah.growthzoneapp.com/communityeventscalendar`

- **Adapter:** `src/lib/scrapers/adapters/html-calendar.ts` (JSON-LD/microdata
  parser). It fetches via `fetchHtml` → `safeFetchHtml`.
- **Error:** `HTTP 403` on about 98% of runs over 7 days (59 runs). The error
  comes from `safeFetchHtml` before any parsing happens, so the parser was never
  reached.
- **Diagnosis:** A steady 403 on both GrowthZone URLs most likely means the host's
  WAF or bot protection is blocking Vercel datacenter IPs or our request. It is
  not a change in page structure, and nothing in the adapter can parse its way
  past it. I could not confirm this live: shell commands weren't allowed and
  WebFetch permission was denied.
- **Why no change:** The only lever in code would be the request headers in
  `src/lib/safe-fetch.ts` (`COMMON_HEADERS`). They are shared by every source, so
  changing them without being able to test would be a guess, and it would risk
  other scrapers. Routing around `safeFetchHtml` is not allowed.
- **Maintainer action:** Disable these two sources, or check from a Vercel
  function whether the 403 is a Cloudflare-style challenge. If BioUtah offers an
  iCal/RSS export or an allowlist for our scraper, switch the sources to that.

## Drifted adapters
None. `drifted-adapters.json` was empty.
