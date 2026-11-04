import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

/* Public routes must not query the database: every query wakes Neon, and
   crawler traffic would keep it awake. They read the shared cached
   dataset through lib/queries.ts instead. Only the routes that write (or
   are admin-only) may reach the database.

   This follows imports transitively (static, re-exports, side-effect and
   dynamic imports; `import type` is skipped) from every public route
   file and every component, and fails if the database module or a
   database driver is reachable by any path other than through
   lib/public-data.ts. */

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");

/* Route folders that may use the database directly (writers, admin). */
const ALLOWED_ROUTES = [
  "admin/",
  "api/cron/",
  "api/email/",
  "api/submit/",
  "api/submit-source/",
  "moderate/",
  "verify/",
  "unsubscribe/",
];

/* The one sanctioned way from a public page to the database: the cached
   dataset, which queries only on a refill. */
const GATEWAY = join(SRC, "lib", "public-data.ts");

const DB_MODULE = join(SRC, "lib", "db", "index.ts");
const DB_PACKAGES = ["drizzle-orm", "@neondatabase/serverless"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/* Specifiers of value imports in a source text. */
export function valueImports(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  /* import ... from "x" and export ... from "x" (multi-line safe). */
  const fromRe = /\b(import|export)\s+([^;'"]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of code.matchAll(fromRe)) {
    const clause = m[2].trim();
    if (/^type\s/.test(clause)) continue;
    /* `import { type A, type B } from` is type-only too. */
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (named) {
      const parts = named[1].split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => /^type\s/.test(p))) continue;
    }
    out.push(m[3]);
  }
  /* Side-effect imports: import "x"; */
  for (const m of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  /* Dynamic imports: import("x") */
  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
}

function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

function isDbPackage(spec: string): boolean {
  return DB_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`));
}

const rel = (p: string) => relative(ROOT, p).split(sep).join("/");

/* Returns the import chain to the database from `entry`, or null. */
function pathToDb(entry: string, cache: Map<string, string[] | null>): string[] | null {
  const seen = new Set<string>();
  function visit(file: string): string[] | null {
    if (file === DB_MODULE) return [rel(file)];
    if (file === GATEWAY) return null;
    if (cache.has(file)) return cache.get(file)!;
    if (seen.has(file)) return null;
    seen.add(file);
    let found: string[] | null = null;
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      if (isDbPackage(spec)) {
        found = [rel(file), spec];
        break;
      }
      const target = resolveLocal(file, spec);
      if (!target) continue;
      const sub = visit(target);
      if (sub) {
        found = [rel(file), ...sub];
        break;
      }
    }
    cache.set(file, found);
    return found;
  }
  return visit(entry);
}

function publicEntries(): string[] {
  const routes = walk(APP).filter((f) => {
    const r = relative(APP, f).split(sep).join("/");
    return !ALLOWED_ROUTES.some((a) => r.startsWith(a));
  });
  return [...routes, ...walk(join(SRC, "components"))];
}

test("no public route or component can reach the database except through the cached dataset", () => {
  const cache = new Map<string, string[] | null>();
  const offenders = publicEntries()
    .map((f) => pathToDb(f, cache))
    .filter((p): p is string[] => p !== null)
    .map((p) => p.join(" -> "));
  assert.deepEqual(offenders, []);
});

test("the public read API never imports the database directly", () => {
  for (const file of ["queries.ts", "tag-events.ts", "public-events.ts"]) {
    assert.equal(pathToDb(join(SRC, "lib", file), new Map()), null, file);
  }
});

test("the check follows imports through lib modules (so it is live)", () => {
  const imports = valueImports(readFileSync(GATEWAY, "utf8"));
  assert.ok(imports.includes("./db"));
  /* The admin health page reaches the database only through lib modules. */
  const chain = pathToDb(join(APP, "admin", "health", "page.tsx"), new Map());
  assert.ok(chain && chain.length > 2, String(chain));
});

test("the import scanner sees every kind of value import and skips type imports", () => {
  const sample = [
    'import { sql } from "drizzle-orm";',
    "import {\n  db,\n  events,\n} from \"@/lib/db\";",
    'export { x } from "./re-export";',
    'import "./side-effect";',
    'const m = await import("./dynamic");',
    'import type { Event } from "@/lib/db/schema";',
    'import { type A, type B } from "./types-only";',
    'import { type C, d } from "./mixed";',
    '/* import { nope } from "./commented"; */',
  ].join("\n");
  assert.deepEqual(valueImports(sample).sort(), [
    "./dynamic",
    "./mixed",
    "./re-export",
    "./side-effect",
    "@/lib/db",
    "drizzle-orm",
  ]);
});
