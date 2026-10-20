-- Disable the lu.ma/slc source row (an alias of lu.ma/saltlakecity that
-- carries requires_review=true, so Luma events it re-ingests land pending).
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
--
-- Run (one transaction; commits only if every statement succeeds):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f disable_luma_slc_alias.sql
--
-- Expected: exactly 1 row changes. Any other count raises, and the whole
-- transaction rolls back.

SELECT id, adapter, url, enabled, requires_review
FROM sources
WHERE url = 'https://lu.ma/slc';

DO $$
DECLARE n int;
BEGIN
  UPDATE sources
  SET enabled = false
  WHERE id = '6fda2e41-8e6e-4943-8909-ecdc4b72a3eb'
    AND url = 'https://lu.ma/slc'
    AND enabled = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected 1 source row, got %', n;
  END IF;
  RAISE NOTICE 'disabled % source row', n;
END $$;
