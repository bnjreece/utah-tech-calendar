"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function ViewTabs({ current }: { current: "list" | "calendar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(view: "list" | "calendar") {
    const sp = new URLSearchParams(searchParams);
    if (view === "list") sp.delete("view");
    else sp.set("view", view);
    router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  const on =
    "text-ink underline decoration-1 underline-offset-4";
  const off =
    "text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors";

  return (
    <span role="tablist" aria-label="View mode" className="inline-flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
      <button
        type="button"
        role="tab"
        aria-selected={current === "list"}
        onClick={() => go("list")}
        className={current === "list" ? on : off}
      >
        list
      </button>
      <span aria-hidden className="text-ink/25">·</span>
      <button
        type="button"
        role="tab"
        aria-selected={current === "calendar"}
        onClick={() => go("calendar")}
        className={current === "calendar" ? on : off}
      >
        by date
      </button>
    </span>
  );
}
