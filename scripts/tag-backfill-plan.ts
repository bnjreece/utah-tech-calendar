/* Tag cleanup planner (2026-10-25). READ-ONLY: one SELECT in a read-only
   transaction, no writes to the database.

   For every approved event it computes the tags the new pipeline gives it
   and prints the difference:
   - a scraped row: what the next rescrape writes (lib/scrape-runner.ts +
     lib/tag-merge.ts): tags inferred by the new rules, unioned with the
     adapter's own tags (recurrence config, Utah Geek Events), the source's
     defaultTags and special-week tags, then the row's stored classifier
     suggestions through the alias map + allowlist, then the special-week
     tags already on the row (they always survive), then implications
     (hard-tech) over the whole result.
   - a manual row (never rescraped): its own tags through the alias map,
     plus the classifier suggestions (what classification now merges).

   Upcoming rows heal themselves on the next scrape cron, so they are only
   reported (the dry run). Past rows are never rescraped, so for them it
   writes an ops SQL file (BEGIN/COMMIT, idempotent, guarded on the exact
   current tags) plus a CSV backup of (id, tags) and a rollback file.

   Run:
     op run --env-file=.env.local -- bun scripts/tag-backfill-plan.ts \
       [--sql ops/2026-10-25/tag_cleanup_past.sql] \
       [--rollback ops/2026-10-25/tag_cleanup_past_rollback.sql] \
       [--csv <backup.csv>] [--diff <per-row-diff.txt>] */
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { buildEventTags, finalizeTags, isCertSpam, llmTagsFor } from "../src/lib/auto-tag";
import { SPECIAL_WEEK_SLUGS, specialWeekTagsFor } from "../src/lib/special-weeks";

interface Row {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  source: string;
  starts_at: string;
  is_online: boolean;
  is_past: boolean;
  stale: boolean;
  llm: unknown;
  source_default_tags: unknown;
  source_cfg_tags: unknown;
}

const FORMAT = new Set(["meetup", "conference", "workshop", "hackathon"]);
const HTW_END = new Date("2026-10-31T06:00:00Z"); /* end of Oct 30, America/Denver */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

/* Tags the adapter itself supplies (EventItem.tags). */
function suppliedTags(r: Row): string[] {
  if (r.source.startsWith("recurrence:")) return strings(r.source_cfg_tags);
  if (r.source === "utah_geek_events") return ["conference"];
  return [];
}

export function newTagsFor(r: Row): string[] {
  const current = r.tags ?? [];
  const certSpam = isCertSpam(`${r.title} ${r.description ?? ""}`);
  const llm = llmTagsFor(r.llm, { certSpam });
  if (r.source === "manual") return finalizeTags([...current, ...llm]);
  const next = buildEventTags({
    title: r.title,
    description: r.description,
    supplied: suppliedTags(r),
    injected: strings(r.source_default_tags),
    specialWeek: specialWeekTagsFor({ title: r.title, startsAt: new Date(r.starts_at) }),
  });
  const kept = current.filter((t) => SPECIAL_WEEK_SLUGS.has(t));
  /* Implications over the whole merge, as lib/tag-merge.ts does: a kept
     week tag still brings hard-tech. */
  return finalizeTags([...next, ...llm, ...kept]);
}

const same = (a: string[] | null, b: string[]) => {
  const x = a ?? [];
  return x.length === b.length && x.every((t, i) => t === b[i]);
};

function count(rows: Row[], pick: (r: Row) => string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) for (const t of new Set(pick(r))) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function table(title: string, rows: Row[], after: Map<string, string[]>): string {
  const b = count(rows, (r) => r.tags ?? []);
  const a = count(rows, (r) => after.get(r.id)!);
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort(
    (x, y) => (a.get(y) ?? 0) - (a.get(x) ?? 0) || (b.get(y) ?? 0) - (b.get(x) ?? 0) || x.localeCompare(y),
  );
  const lines = [`${title} (${rows.length} rows)`, "  tag                   before  after  change"];
  for (const k of keys) {
    const bv = b.get(k) ?? 0;
    const av = a.get(k) ?? 0;
    const d = av - bv;
    lines.push(`  ${k.padEnd(20)} ${String(bv).padStart(7)} ${String(av).padStart(6)}  ${d === 0 ? "" : d > 0 ? `+${d}` : d}`);
  }
  return lines.join("\n");
}

const isTopic = (t: string) => !FORMAT.has(t) && !SPECIAL_WEEK_SLUGS.has(t);
function noTopicShare(rows: Row[], pick: (r: Row) => string[]): string {
  const n = rows.filter((r) => !pick(r).some(isTopic)).length;
  return `${n}/${rows.length} (${rows.length ? Math.round((100 * n) / rows.length) : 0}%)`;
}

function sqlArray(tags: string[] | null): string {
  if (tags === null) return "NULL::text[]";
  if (tags.length === 0) return "'{}'::text[]";
  return `ARRAY[${tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ")}]::text[]`;
}

function pgArrayLiteral(tags: string[] | null): string {
  if (tags === null) return "";
  return `{${tags.map((t) => `"${t.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const [rows] = (await sql.transaction(
    [
      sql`SELECT e.id, e.title, e.description, e.tags, e.source, e.starts_at, e.is_online,
            e.starts_at < now() AS is_past,
            e.updated_at < now() - interval '1 day' AS stale,
            e.llm_verdict->'suggestedTags' AS llm,
            s.config->'defaultTags' AS source_default_tags,
            s.config->'tags' AS source_cfg_tags
          FROM events e LEFT JOIN sources s ON s.id = e.source_id
          WHERE e.status = 'approved'
          ORDER BY e.starts_at, e.id`,
    ],
    { readOnly: true },
  )) as unknown as [Row[]];

  /* The driver may hand back a Date; keep one ISO string shape. */
  for (const r of rows) r.starts_at = new Date(r.starts_at as unknown as string).toISOString();
  const after = new Map(rows.map((r) => [r.id, newTagsFor(r)]));
  const past = rows.filter((r) => r.is_past);
  const upcoming = rows.filter((r) => !r.is_past);
  const changedPast = past.filter((r) => !same(r.tags, after.get(r.id)!) && !(r.tags === null && after.get(r.id)!.length === 0));
  const changedUp = upcoming.filter((r) => !same(r.tags, after.get(r.id)!));

  const upInPerson = upcoming.filter((r) => !r.is_online);
  const upInPersonPostHtw = upInPerson.filter((r) => new Date(r.starts_at) >= HTW_END);

  const out: string[] = [];
  out.push(`approved rows: ${rows.length} (past ${past.length}, upcoming ${upcoming.length})`);
  out.push(`past rows whose tags change (backfill): ${changedPast.length}`);
  out.push(`upcoming rows whose tags change on the next rescrape (dry run): ${changedUp.length}`);
  const staleUp = changedUp.filter((r) => r.stale);
  out.push(
    `  of those, not rescraped in the last 24h (may not self-heal soon; manual rows never do): ${staleUp.length}` +
      ` [${[...count(staleUp, (r) => [r.source]).entries()].map(([k, v]) => `${k} ${v}`).join(", ")}]`,
  );
  out.push("");
  out.push("No topic tag (only format/week tags or none), upcoming in-person:");
  out.push(`  all upcoming in-person:   before ${noTopicShare(upInPerson, (r) => r.tags ?? [])}  after ${noTopicShare(upInPerson, (r) => after.get(r.id)!)}`);
  out.push(`  after Hard Tech Week:     before ${noTopicShare(upInPersonPostHtw, (r) => r.tags ?? [])}  after ${noTopicShare(upInPersonPostHtw, (r) => after.get(r.id)!)}`);
  out.push("");
  out.push(table("UPCOMING approved, dry run", upcoming, after));
  out.push("");
  out.push(table("PAST approved, backfill", past, after));
  out.push("");
  out.push(table("ALL approved", rows, after));
  console.log(out.join("\n"));

  const diffPath = arg("--diff");
  if (diffPath) {
    const lines: string[] = [];
    for (const [label, list] of [
      ["PAST (backfill)", changedPast],
      ["UPCOMING (dry run, next rescrape)", changedUp],
    ] as const) {
      lines.push(`## ${label}: ${list.length} rows`);
      for (const r of list) {
        const b = r.tags ?? [];
        const a = after.get(r.id)!;
        const removed = b.filter((t) => !a.includes(t));
        const added = a.filter((t) => !b.includes(t));
        lines.push(
          `${r.starts_at.slice(0, 10)} ${r.id} ${r.source} | ${r.title.slice(0, 80)}\n    before [${b.join(", ")}]\n    after  [${a.join(", ")}]  -${removed.join(",")} +${added.join(",")}`,
        );
      }
    }
    writeFileSync(diffPath, lines.join("\n") + "\n");
    console.log(`\nper-row diff: ${diffPath}`);
  }

  const csvPath = arg("--csv");
  if (csvPath) {
    /* Postgres CSV: an unquoted empty field is NULL. */
    const csv = [
      "id,tags",
      ...changedPast.map((r) => `${r.id},${r.tags === null ? "" : `"${pgArrayLiteral(r.tags).replace(/"/g, '""')}"`}`),
    ];
    writeFileSync(csvPath, csv.join("\n") + "\n");
    console.log(`backup CSV (${changedPast.length} rows): ${csvPath}`);
  }

  const values = (pick: (r: Row) => [string[] | null, string[] | null]) =>
    changedPast
      .map((r) => {
        const [from, to] = pick(r);
        return `  ('${r.id}'::uuid, ${sqlArray(from)}, ${sqlArray(to)})`;
      })
      .join(",\n");

  const tagCounts = table("Per-tag counts, PAST approved rows (before -> after this file)", past, after)
    .split("\n")
    .map((l) => `-- ${l}`)
    .join("\n");

  const header = (what: string, n: number) => `-- ${what}
-- Generated ${new Date().toISOString()} by scripts/tag-backfill-plan.ts from a read-only SELECT.
-- Scope: approved events with starts_at < now() whose tags differ from what the
-- new tag pipeline produces (2026-10-25 tag cleanup: alias map, title-first topic
-- rules, hard-tech umbrella, classifier suggestedTags merged). Upcoming rows are
-- NOT touched: the next scrape cron rewrites them.
-- Expected rows: ${n} (re-running after success updates 0: each row is guarded on
-- its exact current tags, so a row changed since the plan is skipped, not clobbered).
-- ORDER: run only AFTER the tag-cleanup code is deployed. Scrapers still revisit
-- some past rows (94 past approved rows were updated in the 24h before planning);
-- old code would put the old tags back on those.
-- Not run by the builder. Production write: independent review first.`;

  const body = (target: "after" | "before") => `BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE events e
     SET tags = v.new_tags
    FROM (VALUES
${values((r) => (target === "after" ? [r.tags, after.get(r.id)!] : [after.get(r.id)!, r.tags]))}
    ) AS v(id, old_tags, new_tags)
   WHERE e.id = v.id
     AND e.status = 'approved'
     AND e.starts_at < now()
     AND e.tags IS NOT DISTINCT FROM v.old_tags;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'tag cleanup (${target === "after" ? "apply" : "rollback"}): % rows updated (expected ${changedPast.length}, or 0 on a re-run)', n;
  IF n > ${changedPast.length} THEN
    RAISE EXCEPTION 'updated % rows, more than the ${changedPast.length} planned', n;
  END IF;
END $$;

COMMIT;
`;

  const sqlPath = arg("--sql");
  if (sqlPath) {
    writeFileSync(sqlPath, `${header("Tag cleanup backfill, PAST approved rows only.", changedPast.length)}\n--\n${tagCounts}\n\n${body("after")}`);
    console.log(`ops SQL: ${sqlPath}`);
  }
  const rbPath = arg("--rollback");
  if (rbPath) {
    writeFileSync(rbPath, `${header("ROLLBACK of tag_cleanup_past.sql: restores the tags it replaced.", changedPast.length)}\n\n${body("before")}`);
    console.log(`rollback SQL: ${rbPath}`);
  }
}

/* Run only as a script, so tests can import newTagsFor. */
if (process.argv[1]?.endsWith("tag-backfill-plan.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
