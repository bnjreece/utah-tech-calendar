-- No-holds autopilot rollout: add the AI Utah Luma calendar, lock the owner's
-- hide of the "AI Breakfast with Carl Case" series, and send today's pending
-- queue back through the (new) autopilot.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
--
-- ORDER: run AFTER feat/autopilot-vertical-publish (no-holds decidePending)
-- is deployed and GET /api/revalidate has been called. Block 3 makes the next
-- classify tick re-score and decide every pending row; on the old code those
-- rows would just be held again.
--
-- Run (one transaction; commits only if every statement succeeds):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f no_holds_ops.sql
--
-- Expected row counts from read-only SELECTs on 2026-11-22:
--   1. sources insert: 1 (0 sources match aiutah / cal-AdnG5dtDv1FMLSZ today).
--      Rerun inserts 0 and passes.
--   2. Carl Case lock: 4 events + 4 ledger rows (all hidden, llm-screened,
--      unlocked, eventbrite, source 3d8d7bad...). Rerun changes 0 and passes.
--   3. pending re-score: 20 rows (20 pending upcoming, all already checked).
--      Accepts 0..40 so new inflow before the run does not abort it.

-- 1. AI Utah (luma.com/aiutah, calendar "AI Utah", cal-AdnG5dtDv1FMLSZ):
--    monthly Demo Day at Pattern in Lehi; 20 events in its ICS feed, none
--    upcoming today (December not posted yet). Only Nov 13 reached us, via
--    the lu.ma/saltlakecity cross-post. requires_review = false like the
--    other organizer calendars (47G, Hard Tech Week): new rows are born
--    approved and still pass the gate and the cross-post sweep. The Luma
--    adapter reads the calendar id from the page and pulls the ICS feed
--    (dry run 2026-11-22: 0 upcoming items, no error).
DO $$
DECLARE n int;
BEGIN
  INSERT INTO sources (adapter, url, enabled, requires_review)
  SELECT 'luma', 'https://luma.com/aiutah', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM sources
    WHERE url ~* '(lu\.ma|luma\.com)/aiutah/?$' OR url ~ 'cal-AdnG5dtDv1FMLSZ'
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, 1) THEN RAISE EXCEPTION 'ai utah source: expected 0 or 1, got %', n; END IF;
  IF (SELECT count(*) FROM sources WHERE url = 'https://luma.com/aiutah') <> 1 THEN
    RAISE EXCEPTION 'ai utah source: expected exactly one row after insert';
  END IF;
  RAISE NOTICE 'ai utah source inserted: %', n;
END $$;

-- 2. "AI Breakfast with Carl Case" is a hide (Benjamin, 2026-11-22: "number
--    3 is a hide"). The 4 instances are already hidden by the model; locking
--    them makes it a human decision, so series memory (scrape-runner) hides
--    every future instance of either title at insert as reason 'series'.
--    hidden_reason 'manual' + status_locked, ledgered like the admin Hide.
DO $$
DECLARE n int;
BEGIN
  WITH before AS (
    SELECT * FROM events
    WHERE title ~* '^AI Breakfast with Carl Case'
      AND source = 'eventbrite' AND status = 'hidden' AND status_locked = false
    FOR UPDATE
  ), upd AS (
    UPDATE events e
    SET hidden_reason = 'manual', status_locked = true, updated_at = now()
    FROM before b
    WHERE e.id = b.id
    RETURNING e.id
  ), led AS (
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, snapshot, llm_verdict)
    SELECT 'scraped_event', b.id, 'hide', 'manual: owner ruled the series a hide (2026-11-22)',
      'hidden', 'hidden', 'b@bnjmn.org', 'admin-ui', b.source_id, b.source,
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
  IF n NOT IN (0, 4) THEN RAISE EXCEPTION 'carl case lock: expected 4 (or 0 on rerun), got %', n; END IF;
  IF EXISTS (SELECT 1 FROM events WHERE title ~* '^AI Breakfast with Carl Case' AND NOT (status = 'hidden' AND status_locked)) THEN
    RAISE EXCEPTION 'carl case lock: an instance is not hidden+locked';
  END IF;
  RAISE NOTICE 'carl case rows locked: %', n;
END $$;

-- 3. Re-score today's pending queue. classifyUnchecked only decides a
--    pending row right after scoring it, so these 20 (held under the old
--    rules) stay pending forever unless llm_checked_at is cleared. Only
--    pending, unlocked, scraped, upcoming rows: exactly the set the
--    autopilot is allowed to act on. No visibility change here; the next
--    cron tick decides them (replay 2026-11-22: 3 publish, 17 hide).
DO $$
DECLARE n int;
BEGIN
  UPDATE events SET llm_checked_at = NULL
  WHERE status = 'pending' AND status_locked = false AND source <> 'manual'
    AND starts_at > now() AND llm_checked_at IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 40 THEN RAISE EXCEPTION 'pending re-score: expected about 20, got %', n; END IF;
  RAISE NOTICE 'pending rows queued for re-score: %', n;
END $$;
