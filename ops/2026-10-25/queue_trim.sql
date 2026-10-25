-- Queue trim, part 2: hide the held pending rows the new low-confidence-yes
-- rule (autopilot:lowconf-yes, lib/autopilot.ts rule 4b) would hide, using
-- each row's STORED verdict. PRODUCTION WRITE. Needs independent review
-- before anyone runs it.
--
-- Why a direct hide and not an llm_checked_at reset: the autopilot only
-- decides a row right after it is classified, so a reset would re-run the
-- model (Haiku, about $0.002 a row, 3 rows) and could change the verdict:
-- a re-scored row at 0.90+ would be auto-published, at 0.85 to 0.89 held
-- again. Hiding on the stored verdict is deterministic and is exactly what
-- the dry run shows (scripts/replay-queue-trim.ts). It writes the same
-- events update + ledger row as applyPendingDecision, in one statement.
--
-- Part 1 (queue twins) needs no SQL: the dedup sweep hides them on the first
-- scrape after the deploy. On 2026-10-25 that is 3 rows:
--   UVU 2026 Bitcoin Conference: Saturday October 31st (keeps 2026 Bitcoin Conference: ...)
--   HackerX - Utah County - Employer Ticket - 12/14, id 2d5c4459 (keeps 4d4ecb91)
--   TECHSPO ... (Internet ~ AdTech ~ MarTech) (keeps TECHSPO ... (AI ~ SaaS ~ AdTech ~ MarTech))
--
-- The ids below are the rows the dry run on 2026-10-25 decided as
-- autopilot:lowconf-yes (all pending, unlocked, upcoming, eventbrite, no
-- ledger history, i.e. autopilot holds). SLC XPR Community Activation (yes,
-- 0.75) is NOT here: crypto stays human.
--   d3e18793  0.75  Tricks, Treats & Tech
--   35b98f31  0.78  Employee Experience in the Age of AI
--   cebb60d0  0.75  EDGE OF AI: Quantum Conversations
--
-- Every condition is re-checked here, so a row a human touched, a re-scrape
-- changed, a re-classification rescored or that already started is skipped.
-- Idempotent: a second run hides 0 rows. Expected on first run: 3.
-- Run (the file has its own BEGIN/COMMIT, so no --single-transaction):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f queue_trim.sql

BEGIN;

DO $$
DECLARE eligible int; n int;
BEGIN
  CREATE TEMP TABLE trim_rows ON COMMIT DROP AS
  SELECT id, hidden_reason AS prior_hidden_reason FROM events
  WHERE id IN (
    'd3e18793-38d6-4f71-8159-ed1ec2601f8b', -- Tricks, Treats & Tech
    '35b98f31-a1e5-49ac-ab0d-2e5dc943744c', -- Employee Experience in the Age of AI
    'cebb60d0-9c74-4c9d-8e0b-58a0d5bd40a8'  -- EDGE OF AI: Quantum Conversations
  )
    AND status = 'pending'
    AND status_locked = false
    AND source <> 'manual'
    AND starts_at > now()
    AND (llm_verdict->>'isTechRelevant')::boolean = true
    AND (llm_verdict->>'isSpam')::boolean = false
    AND (llm_verdict->>'confidence')::numeric < 0.85
    AND EXISTS (SELECT 1 FROM admin_settings WHERE id = 1 AND llm_gate_enabled);
  GET DIAGNOSTICS eligible = ROW_COUNT;

  WITH upd AS (
    UPDATE events e
    SET status = 'hidden', hidden_reason = 'llm-screened', updated_at = now()
    FROM trim_rows t
    WHERE e.id = t.id
      -- same guards again, under the row lock the UPDATE takes
      AND e.status = 'pending' AND e.status_locked = false AND e.starts_at > now()
    RETURNING e.*, t.prior_hidden_reason
  ), led AS (
    INSERT INTO review_decisions
      (subject_type, subject_id, decision, reason, prior_status, new_status,
       decided_by, channel, source_id, adapter, llm_verdict, snapshot)
    SELECT 'scraped_event', upd.id, 'hide', 'autopilot:lowconf-yes', 'pending', 'hidden',
      'autopilot', 'auto', upd.source_id, upd.source, upd.llm_verdict,
      -- same shape as eventSnapshot() in lib/review-log.ts
      jsonb_build_object(
        'title', upd.title, 'description', upd.description, 'link', upd.link,
        'source', upd.source, 'venueName', upd.venue_name, 'address', upd.address,
        'city', upd.city, 'isOnline', upd.is_online, 'tags', to_jsonb(upd.tags),
        'flags', jsonb_build_object(
          'isConference', upd.is_conference, 'isPaid', upd.is_paid,
          'hiddenReason', upd.prior_hidden_reason))
    FROM upd
    RETURNING subject_id
  )
  SELECT count(*) INTO n FROM led;

  IF n <> eligible OR n > 3 THEN
    RAISE EXCEPTION 'expected % hides with ledger rows, got %', eligible, n;
  END IF;
  RAISE NOTICE 'hid % of 3 rows (expected 3 on the first run, 0 after)', n;
END $$;

COMMIT;
