"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
      <Button
        variant={current === "list" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => go("list")}
        className="h-8"
      >
        List
      </Button>
      <Button
        variant={current === "calendar" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => go("calendar")}
        className="h-8"
      >
        By date
      </Button>
    </div>
  );
}
