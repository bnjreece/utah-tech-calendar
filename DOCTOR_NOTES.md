# Scraper doctor notes (2026-11-05)

No adapter code changed. Neither problem looked like a parser bug I could fix
safely without seeing the live pages, and in this run I could not fetch them
(WebFetch was not allowed, and shell commands were out of scope).

## Errored: BioUtah (htmlCalendar adapter), needs a maintainer

Sources:
- `a32efa7b-f670-4834-b5a4-78b05eefe781`: https://bioutah.growthzoneapp.com/eventscalendar
- `d5b43dd4-7d2d-420b-a813-4d0464fdf353`: https://bioutah.growthzoneapp.com/communityeventscalendar

Error: `HTTP 403` on every run in the last 7 days (56 of 56). The fetch fails
before any parsing starts, so the JSON-LD and microdata parsing in
`src/lib/scrapers/adapters/html-calendar.ts` never runs and is not the cause.
A steady 403 on the page itself most likely means GrowthZone now blocks our
server or user agent (bot protection or an IP block). The page structure
probably did not change.

Changes I did not make:
- Changing the shared headers in `src/lib/safe-fetch.ts`. Every adapter uses
  them, and it is not clear that a different user agent would get past the block.
- Moving the fetch to another GrowthZone endpoint, such as an RSS or ICS feed,
  or to a mirror. I could not check that one exists or isn't blocked too.
  Every fetch must still go through `safeFetchHtml`.

Recommendation: disable both sources until someone checks by hand
(`scripts/test-bioutah.ts`). If BioUtah has a public feed or a mirror on
Eventbrite or Luma, point the sources at that instead.

## Drifted: luma adapter, expected, no fix needed

Regressed URLs:
- https://luma.com/47g-hardtechweek: the official Hard Tech Week calendar.
  Its events ran from Oct 26 to Oct 30, 2026 (the dates in
  `tests/fixtures/luma-hard-tech-week.ics` and
  `ops/2026-10-25/hard_tech_week_source.sql`). The week is over, so the ICS
  path (`upcomingIcs`) correctly returns nothing upcoming. Disable the source,
  or leave it for next year's week.
- https://lu.ma/utahcrypto: probably just has no upcoming events right now.

Only 2 of the 5 Luma sources with history dropped to zero, and the other 3
still produce events, so the `__NEXT_DATA__` and ICS parsing still works. If
utahcrypto shows upcoming events on luma.com in a browser and still scrapes 0,
look at `calendarApiIdOf` (`props.pageProps.initialData.kind === "calendar"`)
and at the `deepFind` predicate in `src/lib/scrapers/adapters/luma.ts`.
