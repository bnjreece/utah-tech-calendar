-- Hard Tech Week: add the official 47G calendar as an auto-approved Luma
-- source, and hide two stale Clark Planetarium listings that Luma deleted.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
--
-- ORDER: run after the feat/hard-tech-week code is deployed. The old Luma
-- adapter reads only the ~20 events in the calendar page, and ignores
-- config.maxItems, so the source would bring in about a third of the week.
--
-- Run (one transaction; commits only if every statement succeeds):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f hard_tech_week_source.sql
--
-- Idempotent: rerunning changes 0 rows in every block. Block 1 accepts 0 or
-- 1 inserts. Block 2 checks each stale listing's FINAL state on its own, so
-- it passes whether this run hid both, one (an admin or a sweep hid the
-- other first) or neither (a rerun).
--
-- How auto-approve works (verified in code, 2026-10-25):
--   sources.requires_review = false makes scrape-runner insert new rows as
--   status 'approved' (true inserts them 'pending'). Safety checks still run:
--   - at insert: cert-spam and craft titles are born hidden, and series
--     memory inherits a human hide on an earlier instance;
--   - after insert: classifyUnchecked (lib/classify.ts) scores up to 25
--     unchecked upcoming rows per tick, so the ~44 new rows are scored over
--     two ticks and are public in the meantime. With
--     admin_settings.llm_gate_enabled = true (threshold 0.92 on 2026-10-25),
--     routeVerdict acts on an approved, unlocked row: crypto/web3 always
--     goes to review ('pending'); otherwise a relevant, non-spam verdict
--     stays approved WHATEVER its confidence (checked before the protected-
--     vertical rule, so a relevant protected-vertical row stays approved);
--     a protected-vertical row that is not relevant goes to review;
--     confident spam, or confident not-tech outside event-like categories,
--     is hidden ('llm-screened'); anything else flagged goes to review. The autopilot
--     acts only on 'pending' rows, so it does not touch this source's rows.
--     requires_review only picks the starting status; it does not bypass
--     the gate.
--   - the cross-post sweep (now with same-day twins) runs after every tick.
--
-- Expected row counts, from read-only SELECTs on 2026-10-25:
--   1. sources insert: 1 (0 sources match 47g-hardtechweek today)
--   2. stale listings hide: 2 events + 2 ledger rows (Opening Party twin,
--      Pitch Competition); both approved, unlocked, no ledger rows yet.
--      Fewer if one was hidden before this runs; the block still passes.
-- First scrape of the new source (dry run, 2026-10-25): 53 upcoming events
-- (47 Luma events + 6 external listings); 9 already exist under source
-- 'luma' with the same evt- ids and are UPDATED, not duplicated; 44 are
-- inserted approved (re-checked 2026-10-25: 53 upcoming feed entries, 9 of
-- the 47 evt- ids in events under source 'luma', 8 approved + 1 pending).
-- The sweep then hides the two external listings that duplicate an
-- existing row and moves their hard-tech-week tag onto it (simulated with
-- the round-2 twin rules on 169 live upcoming approved rows, re-read
-- 2026-10-25; no exact/prefix/venue clusters today or with the new rows): Women in Tech Salt Lake City 2026 (same Eventbrite link)
-- and Vibe Code Club for Entrepreneurs (calendar pointer, same minute as
-- the Silicon Slopes row). It hides nothing on today's rows without the
-- new source. The two other "Hard Tech Week" rows the 2026-10-25 audit
-- matched are the stale listings hidden below.

-- 1. The official calendar. url is the calendar page; the adapter reads the
--    calendar id from it and pulls the ICS feed. No group: there is no 47G
--    row in groups (the lu.ma/47G_Utah source has none either).
--    config.defaultTags puts every event from this calendar under the
--    hard-tech-week tag; maxItems 100 covers the ~55-event week.
--    Expected: 1 (0 on rerun).
SELECT id, adapter, url, enabled, requires_review, config
FROM sources
WHERE lower(rtrim(url, '/')) IN ('https://luma.com/47g-hardtechweek', 'https://lu.ma/47g-hardtechweek');

DO $$
DECLARE n int;
BEGIN
  INSERT INTO sources (adapter, url, enabled, requires_review, config)
  SELECT 'luma', 'https://luma.com/47g-hardtechweek', true, false,
    '{"defaultTags": ["hard-tech-week"], "maxItems": 100}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM sources
    WHERE lower(rtrim(url, '/')) IN ('https://luma.com/47g-hardtechweek', 'https://lu.ma/47g-hardtechweek')
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 1 THEN RAISE EXCEPTION 'hard tech week source: expected 0 or 1, got %', n; END IF;
  RAISE NOTICE 'inserted % Hard Tech Week source', n;
END $$;

-- 2. Two July "save the date" listings on lu.ma/47G_Utah at Clark
--    Planetarium. Luma's event endpoint returns "This event has been
--    deleted." for both; nothing has refreshed them since 2026-09-16, so
--    they still show on the public calendar:
--    - evt-Q63JywDcGB9ut21 "Hard Tech Week Opening Party", Oct 26 6:30pm,
--      a stale copy of the live evt-zVrciaV3YtD2HtB (6:00pm, Traeger HQ).
--      Different venue, link and minute, so the same-day-twins sweep does
--      NOT treat them as one event; it is hidden here. hidden_reason
--      'cross-post' (a duplicate listing, the reason the sweep uses).
--    - evt-NXojnHmT1CHRqJw "Hard Tech Week Pitch Competition", Oct 26
--      5:30pm. Not on the official calendar; no live twin, so no sweep
--      catches it. hidden_reason 'manual'.
--    Hidden the way the admin Hide action does (unlocked, restorable from
--    /admin/hidden), and ledgered in the same statement.
--    Expected: 2 events + 2 ledger rows (0 on rerun). Each target's final
--    state is then checked on its own: hidden for any reason passes; a row
--    an admin approved and locked is left alone with a WARNING; a missing
--    row, or one still approved and unlocked, raises.
DO $$
DECLARE n int; r record;
BEGIN
  WITH before AS (
    SELECT * FROM events
    WHERE source = 'luma'
      AND external_id IN ('evt-Q63JywDcGB9ut21', 'evt-NXojnHmT1CHRqJw')
      AND id IN ('e48f1519-fe85-4314-8741-b10b6f83dad2', 'bae95611-7e19-4b63-b2f4-9cddab86a145')
      AND status = 'approved' AND status_locked = false
    FOR UPDATE
  ), upd AS (
    UPDATE events e
    SET status = 'hidden',
        hidden_reason = CASE WHEN b.external_id = 'evt-Q63JywDcGB9ut21' THEN 'cross-post' ELSE 'manual' END,
        updated_at = now()
    FROM before b
    WHERE e.id = b.id AND e.status = 'approved'
    RETURNING e.id
  ), led AS (
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, snapshot, llm_verdict)
    SELECT 'scraped_event', b.id, 'hide',
      CASE WHEN b.external_id = 'evt-Q63JywDcGB9ut21'
        THEN 'cross-post: stale twin of evt-zVrciaV3YtD2HtB, deleted on Luma'
        ELSE 'deleted on Luma (event-deleted), not on the official Hard Tech Week calendar' END,
      'approved', 'hidden', 'b@bnjmn.org', 'admin-ui', b.source_id, b.source,
      jsonb_build_object(
        'title', b.title, 'description', b.description, 'link', b.link,
        'source', b.source, 'venueName', b.venue_name, 'address', b.address,
        'city', b.city, 'isOnline', b.is_online, 'tags', to_jsonb(b.tags),
        'flags', jsonb_build_object('isConference', b.is_conference,
          'isPaid', b.is_paid, 'hiddenReason', b.hidden_reason)),
      b.llm_verdict
    FROM before b JOIN upd u ON u.id = b.id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM led;
  IF n > 2 THEN RAISE EXCEPTION 'stale listings: expected at most 2, got %', n; END IF;
  RAISE NOTICE 'hid % stale listings in this run', n;

  FOR r IN
    SELECT t.ext, e.status, e.status_locked, e.hidden_reason
    FROM (VALUES
      ('e48f1519-fe85-4314-8741-b10b6f83dad2'::uuid, 'evt-Q63JywDcGB9ut21'),
      ('bae95611-7e19-4b63-b2f4-9cddab86a145'::uuid, 'evt-NXojnHmT1CHRqJw')
    ) AS t(id, ext)
    LEFT JOIN events e ON e.id = t.id AND e.source = 'luma' AND e.external_id = t.ext
  LOOP
    IF r.status IS NULL THEN
      RAISE EXCEPTION 'stale listing % not found', r.ext;
    ELSIF r.status = 'approved' AND NOT r.status_locked THEN
      RAISE EXCEPTION 'stale listing % is still approved', r.ext;
    ELSIF r.status = 'approved' THEN
      RAISE WARNING 'stale listing % was approved and locked by an admin; left alone', r.ext;
    ELSE
      RAISE NOTICE 'stale listing %: % (%)', r.ext, r.status, coalesce(r.hidden_reason, 'no reason');
    END IF;
  END LOOP;
END $$;

-- Check.
SELECT external_id, status, hidden_reason, title
FROM events
WHERE external_id IN ('evt-Q63JywDcGB9ut21', 'evt-NXojnHmT1CHRqJw', 'evt-zVrciaV3YtD2HtB')
ORDER BY starts_at;
