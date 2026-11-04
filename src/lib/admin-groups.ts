import { asc, eq } from "drizzle-orm";
import { db, groups, type Group } from "@/lib/db";

/* Active groups for the admin group pickers. Admin pages read the
   database directly; public pages use lib/queries.ts instead. */
export async function getAllGroups(): Promise<Group[]> {
  return db.select().from(groups).where(eq(groups.status, "active")).orderBy(asc(groups.name));
}
