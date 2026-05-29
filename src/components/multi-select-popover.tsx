"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Option {
  value: string;
  label: string;
  count?: number;
  dotClass?: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  align?: "start" | "center" | "end";
  searchable?: boolean;
}

export function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
  align = "start",
  searchable,
}: Props) {
  const [q, setQ] = useState("");
  const filtered = searchable && q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const count = selected.length;

  return (
    <Popover>
      <PopoverTrigger
        className={
          count > 0
            ? "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/85 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
            : "inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1.5 text-sm font-medium text-foreground/75 hover:bg-foreground/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
        }
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-background/20 px-1.5 text-xs tabular-nums leading-5">
            {count}
          </span>
        )}
        <svg viewBox="0 0 10 6" aria-hidden className="size-2.5">
          <path d="M.5.5 5 5l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-2">
        {searchable && (
          <input
            type="search"
            placeholder={`Search ${label.toLowerCase()}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={`Search ${label}`}
            className="mb-2 w-full rounded-md bg-foreground/[0.04] px-2.5 py-1.5 text-sm placeholder:text-foreground/40 focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1 max-sm:text-base"
          />
        )}
        <ul role="list" className="max-h-64 overflow-auto flex flex-col gap-px">
          {filtered.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-foreground/55">No matches</li>
          )}
          {filtered.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/[0.04] transition-colors"
                >
                  <span className="truncate flex-1 inline-flex items-center gap-2">
                    {opt.dotClass && (
                      <span aria-hidden className={`size-2 rounded-full shrink-0 ${opt.dotClass}`} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {opt.count !== undefined && (
                      <span className="tabular-nums text-xs text-ink-soft">
                        {opt.count}
                      </span>
                    )}
                    {on && (
                      <svg viewBox="0 0 14 14" aria-hidden className="size-4 text-sunset-deep">
                        <path
                          d="M3 8L6 11L11 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {count > 0 && (
          <div className="mt-2 pt-2 border-t border-foreground/10">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-foreground/55 hover:text-foreground transition-colors"
            >
              Clear {count}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
