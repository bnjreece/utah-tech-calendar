"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export type ScheduleDensity = "weekly" | "monthly";

/* Cookie name shared with src/app/page.tsx so the server-rendered initial
   density can read what the client wrote. One year so it survives most
   refresh cycles. */
const DENSITY_COOKIE = "schedule_density";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

function setDensityCookie(next: ScheduleDensity) {
  if (typeof document === "undefined") return;
  document.cookie = `${DENSITY_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`;
}

export function DensityToggle({ current }: { current: ScheduleDensity }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const buildHref = (next: ScheduleDensity) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "weekly") sp.delete("density");
    else sp.set("density", next);
    return `${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`;
  };

  const active =
    "italic text-ink underline decoration-1 underline-offset-[6px] decoration-ink/40";
  const inactive =
    "not-italic font-normal text-ink/40 hover:text-ink hover:italic transition-colors";

  return (
    <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
      <span className="text-ink/40 not-italic font-normal mr-3">view</span>
      <Link
        href={buildHref("weekly")}
        onClick={() => setDensityCookie("weekly")}
        aria-current={current === "weekly" ? "page" : undefined}
        className={current === "weekly" ? active : inactive}
      >
        weekly
      </Link>
      <span aria-hidden className="text-ink/30 not-italic font-normal mx-3">
        ·
      </span>
      <Link
        href={buildHref("monthly")}
        onClick={() => setDensityCookie("monthly")}
        aria-current={current === "monthly" ? "page" : undefined}
        className={current === "monthly" ? active : inactive}
      >
        monthly
      </Link>
    </h2>
  );
}
