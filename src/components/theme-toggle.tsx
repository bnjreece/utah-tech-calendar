"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipPanel, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "utc:theme";

/* Dark mode toggle. Reads localStorage first, falls back to system
   preference. Suppresses the flash-of-wrong-theme by mounting in a
   transparent state (label is empty until hydrated) - the actual
   dark class is applied before paint by a tiny inline script in
   layout.tsx <head>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    /* Intentional: theme is client-only (localStorage / system pref) and
       must initialize post-mount to avoid a hydration mismatch. */
    if (stored === "dark" || stored === "light") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode or quota - silent */
    }
  }

  /* Mounted-hidden during SSR + initial paint to avoid mismatch. */
  const label = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            className="inline-flex items-center justify-center rounded-md p-2 -mr-1 text-ink-soft hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
          />
        }
      >
        {/* Sun and moon, swapped by theme. Both rendered for stable
            layout; opacity flips on toggle. */}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          {theme === "dark" ? (
            /* sun */
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" />
            </g>
          ) : (
            /* moon */
            <path
              d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a5 5 0 0 0 7 7z"
              fill="currentColor"
            />
          )}
        </svg>
      </TooltipTrigger>
      <TooltipPanel>{label}</TooltipPanel>
    </Tooltip>
  );
}
