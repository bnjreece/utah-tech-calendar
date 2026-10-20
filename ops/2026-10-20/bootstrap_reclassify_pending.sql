-- Reset llm_checked_at on upcoming, unlocked pending events so the
-- classifier re-scores them on the next scrape ticks (25 per tick, newest
-- first) and the queue autopilot routes each one inline as it is scored.
-- Without this the backlog never drains: the autopilot only acts on a row
-- right after it is classified, and every pending row already has a verdict.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
--
-- ORDER: run only after the autopilot is deployed, with AUTOPILOT_PUBLISH
-- set the way it should stay. Rows re-scored while publishing is off are
-- held, and holds are not revisited (they expire unless a human acts).
--
-- Only llm_checked_at is reset. The old llm_verdict stays until the new one
-- overwrites it, so /admin/review and the digest still show a verdict while
-- the backlog drains, and a row that expires first is ledgered with it.
--
-- Run (one transaction; commits only if every statement succeeds):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f bootstrap_reclassify_pending.sql
--
-- Expected: on 2026-10-20 the count was 106. The guard allows 1 to 150 rows
-- (the queue shrinks as events start and grows with inflow); anything outside
-- that raises and the transaction rolls back.

DO $$
DECLARE n int;
BEGIN
  UPDATE events
  SET llm_checked_at = NULL
  WHERE status = 'pending' AND status_locked = false AND starts_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n < 1 OR n > 150 THEN
    RAISE EXCEPTION 'expected 1 to 150 pending rows, got %', n;
  END IF;
  RAISE NOTICE 'reset % pending rows for re-classification', n;
END $$;
