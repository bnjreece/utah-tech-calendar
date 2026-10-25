import Link from "next/link";
import { specialWeekDates, specialWeekHref, type SpecialWeek } from "@/lib/special-weeks";

/* Small dated call-out for a special week (lib/special-weeks.ts) on the
   homepage. The page decides whether it shows (the week's banner window);
   `filtered` is true when the week's filter is already applied, so the
   link offers the way back instead. */
export function SpecialWeekBanner({ week, filtered }: { week: SpecialWeek; filtered: boolean }) {
  return (
    <aside
      aria-label={week.label}
      className="mb-8 border-l-2 border-sunset-deep bg-sunset/[0.07] px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
          {specialWeekDates(week)}
        </p>
        <p className="mt-1 text-sm sm:text-base text-ink text-pretty leading-snug">
          <span className="font-display italic text-lg sm:text-xl text-ink">{week.label}.</span>{" "}
          <span className="text-ink-soft">{week.blurb}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 shrink-0 text-sm">
        <Link
          href={filtered ? "/" : specialWeekHref(week)}
          className="font-medium text-sunset-deep underline decoration-1 underline-offset-4 hover:text-ink transition-colors"
        >
          {filtered ? "Show all events" : "See the week's events"}
        </Link>
        {week.officialUrl && (
          <a
            href={week.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft underline decoration-1 underline-offset-4 hover:text-ink transition-colors"
          >
            Official calendar
          </a>
        )}
      </div>
    </aside>
  );
}
