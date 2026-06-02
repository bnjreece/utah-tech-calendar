import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { listPastPeriodSlugs } from "@/lib/period";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archive - past Utah tech events",
  description:
    "Browse what happened, month by month. Past Utah tech meetups, conferences, founder mixers, AI nights, and biotech demos archived for reference.",
  alternates: { canonical: "/archive" },
  openGraph: {
    type: "website",
    title: `Archive · ${SITE_NAME}`,
    description: "Past Utah tech events, month by month.",
    url: absoluteUrl("/archive"),
  },
};

async function countByPeriod(periods: ReturnType<typeof listPastPeriodSlugs>) {
  /* One COUNT(*) per month with grouped SQL would be tidier, but with
     24 months and parameterized ranges this is fine and keeps the
     query simple. */
  const counts = await Promise.all(
    periods.map(async (p) => {
      const from = new Date(Date.UTC(p.year, p.monthIndex, 1));
      const to = new Date(Date.UTC(p.year, p.monthIndex + 1, 1));
      const rows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(events)
        .where(
          and(
            eq(events.status, "approved"),
            gte(events.startsAt, from),
            lt(events.startsAt, to),
          ),
        );
      return { ...p, count: rows[0]?.c ?? 0 };
    }),
  );
  return counts;
}

export default async function ArchivePage() {
  const periods = listPastPeriodSlugs(new Date(), 24);
  const withCounts = await countByPeriod(periods);
  /* Drop months with zero events - thin pages dilute SEO and waste a
     visitor's click. */
  const populated = withCounts.filter((p) => p.count > 0);

  /* Group by year for visual rhythm. */
  const byYear: Record<string, typeof populated> = {};
  for (const p of populated) {
    const key = String(p.year);
    (byYear[key] ??= []).push(p);
  }
  const years = Object.keys(byYear).sort().reverse();

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 theme-editorial">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Archive
      </p>
      <h1
        className="mt-4 font-display italic tracking-tight text-ink leading-[1.05] text-4xl sm:text-5xl"
        style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
      >
        What happened, by month.
      </h1>
      <p className="mt-5 max-w-[60ch] text-base text-ink-soft text-pretty leading-relaxed">
        Past Utah tech events, archived for reference. Pick a month
        and see what shipped. Indexed back two years.
      </p>

      {populated.length === 0 ? (
        <p className="mt-12 font-display italic text-2xl text-ink-soft">
          Nothing archived yet.
        </p>
      ) : (
        <div className="mt-12 flex flex-col gap-12">
          {years.map((year) => (
            <section key={year}>
              <h2
                className="font-display italic tracking-tight text-ink text-2xl sm:text-3xl mb-6"
                style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
              >
                {year}
              </h2>
              <ul className="flex flex-col">
                {byYear[year].map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/events/${p.slug}`}
                      className="group flex items-baseline justify-between gap-6 border-t border-ink/12 first:border-t-0 py-4 transition-colors hover:bg-paper-deep/40"
                    >
                      <span
                        className="font-display text-xl italic text-ink"
                        style={{
                          fontFamily: "Fraunces, ui-serif, Georgia, serif",
                        }}
                      >
                        {p.display}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft tabular-nums">
                        {p.count} event{p.count === 1 ? "" : "s"} →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        <Link href="/" className="hover:text-ink transition-colors">
          ← back to the schedule
        </Link>
      </p>
    </article>
  );
}
