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

  const tabBase =
    "rounded-full px-3.5 py-1 text-sm font-medium transition-colors";
  const tabOn = "bg-foreground text-background";
  const tabOff = "text-foreground/55 hover:text-foreground";

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={current === "list"}
        onClick={() => go("list")}
        className={`${tabBase} ${current === "list" ? tabOn : tabOff}`}
      >
        List
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "calendar"}
        onClick={() => go("calendar")}
        className={`${tabBase} ${current === "calendar" ? tabOn : tabOff}`}
      >
        By date
      </button>
    </div>
  );
}
