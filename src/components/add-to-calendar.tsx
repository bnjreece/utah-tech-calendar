"use client";

import { useState, useRef, useEffect } from "react";

interface AddToCalendarProps {
  eventId: string;
  eventSlug: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
}

function toGoogleDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return `${fmt(start)}/${fmt(end)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function googleUrl(p: AddToCalendarProps): string {
  const start = new Date(p.startsAt);
  const end = p.endsAt ? new Date(p.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const detailLines = [p.description ?? "", p.url ? `\n\nMore: ${p.url}` : ""].filter(Boolean);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    dates: toGoogleDateRange(start, end),
    details: detailLines.join(""),
    location: p.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function outlookUrl(p: AddToCalendarProps): string {
  const start = new Date(p.startsAt);
  const end = p.endsAt ? new Date(p.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: p.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: [p.description ?? "", p.url ? `\n\nMore: ${p.url}` : ""].filter(Boolean).join(""),
    location: p.location ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

export function AddToCalendar(props: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = "add-to-cal-panel";

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    /* pointerdown covers mouse + touch + pen in one event; avoids the
       mobile Safari quirk where mousedown can lag a tap. */
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const icsUrl = `/api/event/${props.eventSlug}/ics`;
  const gUrl = googleUrl(props);
  const oUrl = outlookUrl(props);

  /* Treat the panel as a disclosure, not an ARIA menu - native link
     semantics work without the menubar-style arrow-key contract that
     `role=menu`/`menuitem` requires. */
  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:border-ink hover:bg-paper-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep"
      >
        Add to calendar
        <span aria-hidden className="text-xs">▾</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-ink/15 bg-paper shadow-lg ring-1 ring-ink/5 overflow-hidden"
        >
          <a
            href={icsUrl}
            download
            className="block px-4 py-3 text-sm text-ink hover:bg-paper-deep"
            onClick={() => setOpen(false)}
          >
            Apple Calendar (.ics)
          </a>
          <a
            href={gUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 text-sm text-ink hover:bg-paper-deep border-t border-ink/10"
            onClick={() => setOpen(false)}
          >
            Google Calendar
          </a>
          <a
            href={oUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 text-sm text-ink hover:bg-paper-deep border-t border-ink/10"
            onClick={() => setOpen(false)}
          >
            Outlook
          </a>
        </div>
      )}
    </div>
  );
}
