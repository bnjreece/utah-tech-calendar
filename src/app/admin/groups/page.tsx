import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { renameGroup, mergeGroups, deleteGroup } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Groups · Admin" };

type Row = {
  id: string;
  name: string;
  slug: string;
  sources: number;
  total_events: number;
  upcoming: number;
};

export default async function AdminGroupsPage() {
  await requireAdmin();

  const result = await db.execute<Row>(sql`
    SELECT g.id, g.name, g.slug,
      count(DISTINCT s.id)::int AS sources,
      count(DISTINCT e.id)::int AS total_events,
      count(DISTINCT e.id) FILTER (WHERE e.starts_at >= now() AND e.status = 'approved')::int AS upcoming
    FROM groups g
    LEFT JOIN sources s ON s.group_id = g.id
    LEFT JOIN events e ON e.group_id = g.id
    GROUP BY g.id, g.name, g.slug
    ORDER BY upcoming DESC, total_events DESC, g.name
  `);
  const list = (Array.isArray(result) ? result : result.rows ?? []) as Row[];

  const fieldClass =
    "rounded-md bg-foreground/[0.04] px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1";
  const btnClass =
    "rounded-md px-2 py-1 text-xs font-medium text-ink-soft hover:text-ink hover:bg-foreground/[0.06] transition-colors";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          Groups · {list.length}
        </h2>
        <p className="mt-2 text-sm text-ink-soft max-w-[60ch]">
          The communities behind events — what people filter and subscribe by.
          Keep this to real organizers. <strong>Delete</strong> ungroups a
          junk/aggregator group (its events stay on the calendar, just without a
          group). <strong>Merge</strong> folds duplicates together.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-ink/10">
        {list.map((g) => (
          <li key={g.id} className="py-4 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0 truncate">
                <span className="font-medium">{g.name}</span>
                <span className="ml-2 font-mono text-[11px] text-ink-soft">{g.slug}</span>
              </div>
              <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
                {g.upcoming} upcoming · {g.total_events} total · {g.sources} src
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <form action={renameGroup} className="flex items-center gap-1">
                <input type="hidden" name="id" value={g.id} />
                <input name="name" defaultValue={g.name} className={fieldClass} aria-label="Group name" />
                <button type="submit" className={btnClass}>Rename</button>
              </form>

              <form action={mergeGroups} className="flex items-center gap-1">
                <input type="hidden" name="fromId" value={g.id} />
                <select name="intoId" defaultValue="" className={fieldClass} aria-label="Merge into">
                  <option value="" disabled>
                    Merge into…
                  </option>
                  {list
                    .filter((o) => o.id !== g.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button type="submit" className={btnClass}>Merge</button>
              </form>

              <form action={deleteGroup}>
                <input type="hidden" name="id" value={g.id} />
                <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-sunset-deep hover:bg-sunset/10 transition-colors">
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
