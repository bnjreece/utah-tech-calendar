-- Queue trim: let the autopilot re-decide the held rows the new
-- low-confidence-yes rule (autopilot:lowconf-yes, lib/autopilot.ts rule 4b)
-- would hide. PRODUCTION WRITE. Needs independent review before anyone
-- runs it, and runs only AFTER the feat/queue-trim deploy is live (on the
-- old code the next classify tick would hold these rows again).
--
-- What it does: sets llm_checked_at = NULL on exactly 3 pending, upcoming,
-- unlocked, scraped rows. Nothing else changes here: no status, no
-- hidden_reason, no ledger row, llm_verdict and updated_at kept. The next
-- classify tick (scrape cron, 25 rows a tick, or /api/cron/classify)
-- re-scores each row and decidePending decides it with every policy hold
-- (crypto, protected verticals, rural, kids) and the CAS write in
-- applyPendingDecision, which ledgers any hide as decided_by 'autopilot'.
--
-- The model runs again (claude-haiku-4-5, about $0.003 a row, under $0.01
-- for all 3), so a verdict CAN change: a re-score under 0.85 is hidden
-- (autopilot:lowconf-yes); 0.85 to 0.89 is held again (hold:unsure);
-- 0.90+ is held unless AUTOPILOT_PUBLISH=on and every publish veto passes,
-- in which case it is published; a "no" is screened or held per rule 4.
-- Check the outcome with scripts/replay-queue-trim.ts or the daily digest.
--
-- Part 1 (queue twins) needs no SQL: the dedup sweep hides them on the first
-- scrape after the deploy (lib/queue-twins.ts, strict evidence only since
-- Astra round 6: same upstream listing id, or a stale relist). Dry run on
-- 2026-10-25 over all 227 upcoming pending + approved rows, 2 hides:
--   7a0d8b29 TECHSPO ... (Internet ~ AdTech ~ MarTech), stale since 10/12
--            (keeps 7a2cbc48 TECHSPO ... (AI ~ SaaS ...), same Eventbrite id 1996064919908)
--   2d5c4459 HackerX - Utah County - Employer Ticket - 12/14, id 1980426340496, stale since 9/28
--            (keeps 4d4ecb91, id 1982701719215, same title and start, still scraped)
-- The two Bitcoin Conference listings (different ids and titles) are left
-- for a human.
--
-- Targets: of the 22 upcoming pending rows on 2026-10-25, 4 have a stored
-- "yes" under 0.85. Running the real decidePending over the stored verdicts
-- (scripts/replay-queue-trim.ts, section 2) gives autopilot:lowconf-yes for 3
-- of them; SLC XPR Community Activation (dc2e89b3, yes 0.75) is held for
-- crypto and is NOT reset. All 3 targets: eventbrite, no ledger history,
-- gate on.
--   d3e18793  0.75  Tricks, Treats & Tech                   (Murray)
--   35b98f31  0.78  Employee Experience in the Age of AI    (Salt Lake City)
--   cebb60d0  0.75  EDGE OF AI: Quantum Conversations       (Salt Lake City)
--
-- Guards, all re-checked by the UPDATE under its row lock (READ COMMITTED
-- re-evaluates the row's WHERE after a concurrent write):
--   . still pending, unlocked, not manual, upcoming, gate on;
--   . llm_checked_at equal to the value the dry run saw, so a row already
--     reset or re-classified since is skipped (this is what makes a second
--     run a no-op);
--   . md5 of the stored verdict and md5 of every row field decidePending's
--     holds read (title, description, city, venue, link, source_id, tags)
--     equal to the dry-run values, so a re-score, re-scrape or edit that
--     could change the policy-hold outcome skips the row;
--   . stored verdict still "yes" under 0.85;
--   . no human (or any non-autopilot) ledger decision on the row.
-- Expected: 3 rows on the first run, 0 on any later run. Raises (and rolls
-- back) if more than 3 would change.
-- Run (the file has its own BEGIN/COMMIT, so no --single-transaction):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f queue_trim.sql

BEGIN;

DO $$
DECLARE n int;
BEGIN
  CREATE TEMP TABLE trim_targets (
    id uuid PRIMARY KEY,
    checked_at timestamptz NOT NULL,
    verdict_md5 text NOT NULL,
    row_md5 text NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO trim_targets VALUES
    ('d3e18793-38d6-4f71-8159-ed1ec2601f8b', '2026-10-20 15:21:43.806+00', '7cc3f8138d344cbd741c4888aa4b095e', 'fb1fb33d9bff1b1527880db9459272e9'), -- Tricks, Treats & Tech
    ('35b98f31-a1e5-49ac-ab0d-2e5dc943744c', '2026-10-20 15:01:54.321+00', '10482eb93ecaf8849ce9cf17df53a34f', 'b7d65a9ff0807c1928547f14f378cc63'), -- Employee Experience in the Age of AI
    ('cebb60d0-9c74-4c9d-8e0b-58a0d5bd40a8', '2026-10-20 15:06:18.285+00', 'ee2c8f2773cac0c4078bf29a1ab6a497', '9a8c2fdbd4f40559f93e234603fe0ed1'); -- EDGE OF AI: Quantum Conversations

  UPDATE events e
  SET llm_checked_at = NULL
  FROM trim_targets t
  WHERE e.id = t.id
    AND e.status = 'pending'
    AND e.status_locked = false
    AND e.source <> 'manual'
    AND e.starts_at > now()
    AND e.llm_checked_at = t.checked_at
    AND md5(e.llm_verdict::text) = t.verdict_md5
    AND md5(concat_ws(chr(31), e.title, e.description, e.city, e.venue_name, e.link,
          e.source_id::text, array_to_string(e.tags, ','))) = t.row_md5
    AND (e.llm_verdict->>'isTechRelevant')::boolean = true
    AND (e.llm_verdict->>'isSpam')::boolean = false
    AND (e.llm_verdict->>'confidence')::numeric < 0.85
    AND NOT EXISTS (
      SELECT 1 FROM review_decisions d
      WHERE d.subject_id = e.id AND d.decided_by <> 'autopilot')
    AND EXISTS (SELECT 1 FROM admin_settings WHERE id = 1 AND llm_gate_enabled);
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n > 3 THEN
    RAISE EXCEPTION 'expected at most 3 resets, got %', n;
  END IF;
  RAISE NOTICE 'reset llm_checked_at on % of 3 rows (expected 3 on the first run, 0 after)', n;
END $$;

COMMIT;
