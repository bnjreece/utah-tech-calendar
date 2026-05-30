"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  feedQuery?: string;
  triggerLabel?: string;
  variant?: "filter-bar" | "card";
}

/* Subscribe popover — calendar deeplinks + copy iCal/RSS URLs.
   feedQuery is the URL search string (without the leading ?) that
   carries the current filter state, so this can power both the
   "subscribe to this view" button and the curated presets page. */
export function SubscribePopover({
  feedQuery = "",
  triggerLabel = "Subscribe",
  variant = "filter-bar",
}: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const icalPath = `/api/ical${feedQuery ? `?${feedQuery}` : ""}`;
  const rssPath = `/api/rss${feedQuery ? `?${feedQuery}` : ""}`;
  const icalUrl = `${origin}${icalPath}`;
  const rssUrl = `${origin}${rssPath}`;
  const webcalUrl = icalUrl.replace(/^https?/, "webcal");
  const googleUrl = origin
    ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icalUrl)}`
    : "#";

  async function copy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  }

  const triggerClass =
    variant === "filter-bar"
      ? "inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 sm:py-1.5 text-base sm:text-sm font-medium text-paper hover:bg-ink/85 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
      : "inline-flex items-center gap-1.5 rounded-full bg-ink px-6 py-3 text-base sm:px-5 sm:py-2.5 sm:text-sm font-medium text-paper hover:bg-ink/85 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep";

  return (
    <Popover>
      <PopoverTrigger className={triggerClass}>
        <span>{triggerLabel}</span>
        <svg viewBox="0 0 10 6" aria-hidden className="size-2.5">
          <path
            d="M.5.5 5 5l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">
          Subscribe
        </p>
        <ul role="list" className="flex flex-col gap-px">
          <li>
            <a
              href={webcalUrl}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 sm:py-2 text-base sm:text-sm hover:bg-ink/[0.04] transition-colors"
            >
              <span>Apple Calendar</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                webcal
              </span>
            </a>
          </li>
          <li>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 sm:py-2 text-base sm:text-sm hover:bg-ink/[0.04] transition-colors"
            >
              <span>Google Calendar</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                opens new
              </span>
            </a>
          </li>
          <li className="border-t border-ink/10 my-1" aria-hidden />
          <li>
            <button
              type="button"
              onClick={() => copy(icalUrl, "ical")}
              className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-2.5 sm:py-2 text-base sm:text-sm text-left hover:bg-ink/[0.04] transition-colors"
            >
              <span>Copy iCal URL</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                {copied === "ical" ? "copied" : ".ics"}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => copy(rssUrl, "rss")}
              className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-2.5 sm:py-2 text-base sm:text-sm text-left hover:bg-ink/[0.04] transition-colors"
            >
              <span>Copy RSS URL</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                {copied === "rss" ? "copied" : "rss"}
              </span>
            </button>
          </li>
        </ul>
        {feedQuery && (
          <p className="mt-2 pt-2 border-t border-ink/10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            With current filters
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
