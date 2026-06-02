"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  links: Array<{ href: string; label: string }>;
}

/* Mobile navigation. The desktop nav uses inline pills; below sm:
   this surface takes over. Full-viewport editorial takeover matching
   the site voice (Fraunces italic headlines + Plex Mono eyebrows +
   generous whitespace), works in both light and dark themes via the
   paper/ink token system. Slides in from the right with a quick
   ease-out. */
export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* Close when route changes. Tracks pathname not search so changing
     a filter on / doesn't slam the sheet shut. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Lock body scroll while open to prevent the background from
     scrolling under the open overlay. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Close on Escape - standard a11y for any modal-like UI. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-md p-2 -mr-2 text-ink-soft hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
      >
        <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden>
          <path
            d="M0 1.5h20M0 12.5h20"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Full-viewport overlay. Renders behind a slight blur so the
          underlying schedule peeks through enough to feel like
          context, not a totally different surface. */}
      <div
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={`fixed inset-0 z-50 bg-paper/95 backdrop-blur-md transition-opacity duration-200 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`mx-auto flex h-dvh max-w-3xl flex-col px-6 transition-transform duration-300 ${
            open ? "translate-y-0" : "-translate-y-2"
          }`}
        >
          {/* Top bar - mirrors the site header rhythm. */}
          <div className="flex items-center justify-between border-b border-ink/15 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Utah Tech Calendar
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md p-2 -mr-2 text-ink-soft hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path
                  d="M1 1l16 16M17 1L1 17"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Link list. Editorial display type with numbered eyebrows -
              each entry reads like a section in a printed periodical. */}
          <nav aria-label="Primary" className="flex-1 overflow-y-auto py-8">
            <ul className="flex flex-col">
              {links.map((l, i) => {
                const isActive =
                  pathname === l.href ||
                  (l.href !== "/" && pathname.startsWith(l.href));
                return (
                  <li
                    key={l.href}
                    className="border-b border-ink/12 first:border-t first:border-ink/12"
                  >
                    <Link
                      href={l.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex items-baseline gap-5 py-5 transition-colors ${
                        isActive
                          ? "text-ink"
                          : "text-ink hover:text-sunset-deep"
                      }`}
                    >
                      <span className="font-mono text-[10px] tabular-nums uppercase tracking-[0.22em] text-ink-soft w-8 shrink-0 mt-1.5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="font-display text-3xl sm:text-4xl italic tracking-tight leading-[1.05] text-pretty"
                        style={{
                          fontFamily:
                            "Fraunces, ui-serif, Georgia, serif",
                        }}
                      >
                        {l.label}
                      </span>
                      <span
                        aria-hidden
                        className="ml-auto text-ink-soft group-hover:text-sunset-deep transition-colors"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer signoff - tiny editorial signature, mirrors the
              site footer voice. */}
          <div className="border-t border-ink/15 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Cottonwood Heights, UT · updated nightly
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
