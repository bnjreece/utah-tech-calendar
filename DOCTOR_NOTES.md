# Scraper doctor notes (2026-11-26)

No code changes. Neither problem is a parser bug.

## Errored: BioUtah GrowthZone calendars (`htmlCalendar` adapter)

- `https://bioutah.growthzoneapp.com/eventscalendar`
- `https://bioutah.growthzoneapp.com/communityeventscalendar`

Both return **HTTP 403** on every run (100% of 56 runs in 7 days). A separate,
non-scraper fetch of both URLs today also got 403 Forbidden, so the host is
refusing automated clients. It is not a change in page structure. The adapter's
JSON-LD and microdata parsing was never reached, so there is nothing to fix in
it. Getting past the block would mean evading the site's bot protection, so I
left the code alone. The alternative host `members.bioutah.org/events/calendar`
currently has an expired TLS certificate, so it is not a usable replacement
either.

**Maintainer action:** disable both sources, or ask BioUtah for a feed (ICS or
RSS) or an allow-listed endpoint and point the source at that.

## Drifted: `luma` adapter

Regressed URLs: `https://lu.ma/utahcrypto`, `https://luma.com/47g-hardtechweek`
(2 of 5 sources with history; the other 3 still produce events).

Both pages still load as normal Luma calendar pages. Each has an "Upcoming" tab
that **lists no events**. Hard Tech Week was a one-off event week that has now
ended, and Utah Crypto Club has nothing scheduled. The scraper reports zero
because those calendars have no upcoming events, not because the upstream format
changed. The other Luma sources still parse, which confirms the
`__NEXT_DATA__`/ICS path works. I left the adapter unchanged.

**Maintainer action:** none needed for Utah Crypto Club (it will pick up new
events when they are posted). You could disable `47g-hardtechweek` until the
next edition is announced.
