-- Disable the lu.ma/slc source row (an alias of lu.ma/saltlakecity that
-- carries requires_review=true, so Luma events it re-ingests land pending).
-- PRODUCTION WRITE. Needs independent review before anyone runs it.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f disable_luma_slc_alias.sql
--
-- Expected: the SELECT shows exactly 1 row
--   6fda2e41-8e6e-4943-8909-ecdc4b72a3eb | luma | https://lu.ma/slc | enabled t | requires_review t
-- and the UPDATE reports "UPDATE 1". Anything else: ROLLBACK.

BEGIN;

SELECT id, adapter, url, enabled, requires_review
FROM sources
WHERE url = 'https://lu.ma/slc';

UPDATE sources
SET enabled = false
WHERE id = '6fda2e41-8e6e-4943-8909-ecdc4b72a3eb'
  AND url = 'https://lu.ma/slc'
  AND enabled = true;

-- Count check: expect UPDATE 1 above. If so COMMIT, otherwise ROLLBACK.
-- COMMIT;
