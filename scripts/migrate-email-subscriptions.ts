/* Idempotent migration for the email_subscriptions table.
   Run once with:
     op run --env-file=.env.local -- bun scripts/migrate-email-subscriptions.ts
   Safe to re-run - all DDL uses IF NOT EXISTS. */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

async function main() {
  console.log("Creating email_subscriptions table if missing…");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      verified_at timestamptz,
      unsubscribed_at timestamptz,
      last_sent_at timestamptz,
      topics text[],
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  console.log("Creating unique index on email…");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_subscriptions_email_idx
      ON email_subscriptions (email)
  `);
  const [{ c }] = (await db.execute<{ c: number }>(sql`
    SELECT count(*)::int as c FROM email_subscriptions
  `)) as unknown as Array<{ c: number }>;
  console.log(`Done. Rows in table: ${c ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
