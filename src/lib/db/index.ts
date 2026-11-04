import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

/* UTE_DB_QUERY_LOG=1 logs one line per database HTTP request (the SQL
   text, never the parameters), to check which requests wake the
   database. Off by default. */
if (process.env.UTE_DB_QUERY_LOG === "1") {
  let sent = 0;
  neonConfig.fetchFunction = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    sent += 1;
    let head = "?";
    try {
      const b = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
      head = String(b.query ?? (Array.isArray(b.queries) ? `batch of ${b.queries.length}` : ""))
        .replace(/\s+/g, " ")
        .slice(0, 80);
    } catch {
      head = "?";
    }
    console.log(`[db-query] #${sent} ${head}`);
    return fetch(input, init);
  };
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export * from "./schema";
