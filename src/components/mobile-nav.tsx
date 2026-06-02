"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  links: Array<{ href: string; label: string }>;
}

/* Mobile hamburger menu. The desktop nav uses inline pills; below
   sm: this surface takes over so the header doesn't get cramped as
   we add admin / discover / submit / subscribe. Opens a small
   editorial sheet rather than a full-screen overlay - we want it to
   feel like the rest of the site, not a generic app drawer. */
export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* Close when route changes. Tracks pathname not search so changing
     a filter on / doesn't slam the sheet shut. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Lock body scroll while open to prevent the background from
     scrolling under the open sheet. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Close on Escape - standard a11y for any popover-like UI. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-md p-2 -mr-2 text-ink-soft hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
      >
        {/* Two-line hamburger; rotates to X via aria state if we want
            to add that later. Keep simple for now - the open sheet
            covers the icon anyway. */}
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          <path d="M0 1.5h18M0 12.5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="Site navigation"
            className="fixed top-0 right-0 z-50 h-dvh w-[80vw] max-w-xs bg-paper border-l-2 border-ink shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-ink/15 px-5 py-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Menu
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="text-ink-soft hover:text-ink p-1 -mr-1"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="flex flex-col px-2 py-4">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block px-3 py-3 rounded-md font-mono text-[12px] uppercase tracking-[0.2em] text-ink hover:bg-paper-deep transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
