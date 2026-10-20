-- Reset the stored verdict on upcoming, unlocked pending events so the
-- classifier re-scores them on the next scrape ticks (25 per tick, about 5
-- ticks) and the queue autopilot routes each one inline as it is scored.
-- Without this the backlog never drains: the autopilot only acts on a row
-- right after it is classified, and every pending row already has a verdict.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
-- The classifier takes newest rows first; inflow is about 20 rows a day, so
-- the backlog still drains in about 5 ticks. A run never classifies pending
-- rows past its publish cap or circuit breaker, so a large manual
-- /api/cron/classify run cannot strand good events as permanent holds.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f bootstrap_reclassify_pending.sql
--
-- ORDER: run only after the autopilot is deployed, with AUTOPILOT_PUBLISH
-- set the way it should stay. Rows re-scored while publishing is off are
-- held, and holds are not revisited (they expire unless a human acts).
--
-- Expected: the SELECT count matches the UPDATE count. On 2026-10-20 that
-- was 106 (0 locked, 0 past-dated); it shrinks as events start. Anything
-- far from the SELECT count: ROLLBACK.

BEGIN;

SELECT count(*) AS expected
FROM events
WHERE status = 'pending' AND status_locked = false AND starts_at > now();

-- Only llm_checked_at is reset. The old llm_verdict stays until the new one
-- overwrites it, so /admin/review and the digest still show a verdict while
-- the backlog drains, and a row that expires first is ledgered with it.
UPDATE events
SET llm_checked_at = NULL
WHERE status = 'pending' AND status_locked = false AND starts_at > now();

-- Count check: expect UPDATE <expected> above. If so COMMIT, otherwise ROLLBACK.
-- COMMIT;
