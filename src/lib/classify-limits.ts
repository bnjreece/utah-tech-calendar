/* Time limits for one classification call (lib/classify.ts). Pure, so
   tests import them without the database or the model client. */

/* The longest one call may take, retries included. */
export const CLASSIFY_CALL_TIMEOUT_MS = 20_000;
/* A call with less time than this is not started. */
export const CLASSIFY_MIN_CALL_MS = 5_000;
