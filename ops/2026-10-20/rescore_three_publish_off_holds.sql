-- Re-score three good events that the 15:00 UTC cron held as
-- "publish-off": that tick ran on the deployment from before
-- AUTOPILOT_PUBLISH=on took effect (all 25 rows it scored were at
-- 15:01:32-15:02:24). With publishing on, the replay publishes all three.
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f rescore_three_publish_off_holds.sql
-- Expected: exactly 3 rows; anything else raises and rolls back.
DO $$
DECLARE n int;
BEGIN
  UPDATE events SET llm_checked_at = NULL
  WHERE id IN (
    '59d96fe9-9025-4a90-88ef-f0d7d846e7f7', -- Makerspace Club: Robotics
    '6acc856f-7158-4705-9f03-0fc25c3211cc', -- Agent Substrate Community Party
    '60c1f9cb-3944-45fb-a9f9-2d5135585487'  -- AprèsKube SLC: Keyboards & Keys
  )
  AND status = 'pending' AND status_locked = false AND starts_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 rows, got %', n; END IF;
  RAISE NOTICE 'reset % rows', n;
END $$;
