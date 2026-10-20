-- Phase 3 of the queue autopilot: prune sources and restore two wrong hides.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
--
-- Run (one transaction; commits only if every statement succeeds):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f phase3_sources_and_restores.sql
--
-- Every block checks its exact row count and raises otherwise, which rolls
-- back the whole file. Disabling a source only stops future scrapes; its
-- existing events are untouched and still flow through the autopilot.

-- 1. The 4 overlapping Salt Lake City Eventbrite keyword searches. About 75%
--    of queue inflow; about 2 events in 5 months that no other source had.
--    Expected: 4 rows.
DO $$
DECLARE n int;
BEGIN
  UPDATE sources SET enabled = false
  WHERE enabled = true AND adapter = 'eventbrite' AND id IN (
    '066ecb4b-7422-4058-b077-6011d3d2c6da', -- ut--salt-lake-city/startup--events
    'fa3f1aa2-1de9-4f8d-821e-aa7657e33e05', -- ut--salt-lake-city/developer--events
    '58224201-f7f5-402d-91c0-39093ac14d71', -- ut--salt-lake-city/ai--events
    '85432591-e2ed-4d0f-a263-7c21e66d1114'  -- ut--salt-lake-city/tech--events
  )
  AND url ~ '^https://www\.eventbrite\.com/d/ut--salt-lake-city/(startup|developer|ai|tech)--events/$';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'eventbrite searches: expected 4, got %', n; END IF;
  RAISE NOTICE 'disabled % Eventbrite searches', n;
END $$;

-- 2. siliconslopes.com/c/events: returns the same 7,106 items as
--    siliconslopes.com/events and inserted 0 rows in 30 days. Expected: 1.
DO $$
DECLARE n int;
BEGIN
  UPDATE sources SET enabled = false
  WHERE enabled = true AND id = '5e95e5a4-f367-453c-80bf-70b5809f315d'
    AND url = 'https://www.siliconslopes.com/c/events';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'silicon slopes alias: expected 1, got %', n; END IF;
  RAISE NOTICE 'disabled % Silicon Slopes alias', n;
END $$;

-- 3. Meetup groups that no longer exist (meetup.com shows "Group not found";
--    0 items in 239 runs). Expected: 9.
DO $$
DECLARE n int;
BEGIN
  UPDATE sources SET enabled = false
  WHERE enabled = true AND adapter = 'meetup' AND id IN (
    'b845ba00-c3a5-4a7d-b9a6-c193ed9b4f12', -- 1-million-cups-ogden
    'cf501097-3b38-42b8-958c-f894211d2351', -- 1-million-cups-provo
    '68e55491-943c-4578-b7ea-ecb99e608aff', -- Utah-Software-Craftsmanship
    '07eb55d0-e593-4502-ab77-4ab30743a678', -- salt-lake-city-aws-user-group
    '7618a6ed-c779-459e-812d-a73780f9adf9', -- the-foundry-by-forge-utah
    'e5bdf56a-4223-490e-b9d5-c368e2385a91', -- utah-elixir
    '2a110fad-83ea-4d33-a170-eba773ec4fe9', -- utah-iot
    '68e135c9-b559-4c38-bda2-1ed648a51d92', -- utah-python-users-group
    '60ebc099-72d7-4281-9684-de5a32f1a742'  -- women-who-go-utah
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 9 THEN RAISE EXCEPTION 'dead meetup groups: expected 9, got %', n; END IF;
  RAISE NOTICE 'disabled % dead Meetup groups', n;
END $$;

-- 4. Luma URLs the adapter cannot read: an admin "manage" URL and a /user/
--    profile page (no event data in the page). 0 items in 239 runs.
--    Expected: 2. (lu.ma/altitudelab, lu.ma/UtahBlockchain and
--    lu.ma/calendar/cal-GGPdsEaoZN7acZ1 are real public calendars with no
--    upcoming events; they stay on.)
DO $$
DECLARE n int;
BEGIN
  UPDATE sources SET enabled = false
  WHERE enabled = true AND adapter = 'luma' AND id IN (
    'c4b74947-c62d-4639-985b-fba631fc5953', -- luma.com/calendar/manage/cal-jjgVAbqU0cMh2jC
    '13f9fd73-355f-41de-9ecf-c11300f6c6de'  -- luma.com/user/philoventures
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'unreadable luma urls: expected 2, got %', n; END IF;
  RAISE NOTICE 'disabled % unreadable Luma URLs', n;
END $$;

-- 5. Restore two wrongly hidden upcoming events, the way the admin Restore
--    button does (approved, hidden_reason NULL, status_locked = true) and
--    ledger each one in the same statement. Benjamin asked for this
--    ("do everything", 2026-10-20).
--    - Saturday Workshop: Speaker Building (Makespace), auto-screened by the
--      model; the replay judged it a real maker workshop.
--    - Daily Grind Network (Nov 6), hidden by the old series rule copying an
--      automatic hide over Benjamin's 2026-06-18 approval of this series.
--    Expected: 2.
DO $$
DECLARE n int;
BEGIN
  WITH before AS (
    SELECT * FROM events
    WHERE id IN ('72507569-de96-4d18-b9a1-43de23544eb0', 'ace8fd58-557b-41b8-8bc0-75d7be911030')
      AND status = 'hidden' AND status_locked = false AND starts_at > now()
  ), upd AS (
    UPDATE events e
    SET status = 'approved', hidden_reason = NULL, status_locked = true, updated_at = now()
    FROM before b
    WHERE e.id = b.id
    RETURNING e.id
  ), led AS (
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, snapshot, llm_verdict)
    SELECT 'scraped_event', b.id, 'restore', 'restored on request: autopilot phase 3 wrong-hide fix',
      'hidden', 'approved', 'b@bnjmn.org', 'admin-ui', b.source_id, b.source,
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
  IF n <> 2 THEN RAISE EXCEPTION 'restores: expected 2, got %', n; END IF;
  RAISE NOTICE 'restored % events', n;
END $$;
