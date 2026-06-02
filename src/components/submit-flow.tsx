"use client";

import { useState } from "react";

type Mode = "event" | "source";

interface ExtractedEvent {
  title: string;
  description: string;
  link: string;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  venueName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  tags: string[];
  imageUrl: string;
}

interface ExtractResponse {
  ok: boolean;
  adapter?: string;
  adapterReason?: string;
  count?: number;
  events?: ExtractedEvent[];
  error?: string;
  hint?: string;
  details?: string;
}

/* URL-first submission flow. Two modes:
   - "event": paste a URL to one event, we run it through the right
     adapter, show the extracted fields editable, then submit.
   - "source": paste a calendar / feed URL, leave a note, admin
     decides whether to register it as a recurring scrape source.
   Both write into pending_submissions; the source variant carries
   type:'source' in its payload so admin/review can route it. */
export function SubmitFlow() {
  const [mode, setMode] = useState<Mode>("event");

  return (
    <div className="flex flex-col gap-8">
      <ModePicker mode={mode} setMode={setMode} />
      <div
        id="submit-mode-event"
        role="tabpanel"
        aria-labelledby="submit-tab-event"
        hidden={mode !== "event"}
      >
        {mode === "event" && <EventByUrl />}
      </div>
      <div
        id="submit-mode-source"
        role="tabpanel"
        aria-labelledby="submit-tab-source"
        hidden={mode !== "source"}
      >
        {mode === "source" && <SourceByUrl />}
      </div>
    </div>
  );
}

function ModePicker({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-2 gap-2 p-1 rounded-full bg-paper-deep ring-1 ring-ink/10">
      {(
        [
          {
            id: "event" as const,
            eyebrow: "One event",
            label: "Paste a URL",
          },
          {
            id: "source" as const,
            eyebrow: "A whole calendar",
            label: "Suggest a source",
          },
        ]
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          id={`submit-tab-${opt.id}`}
          role="tab"
          aria-selected={mode === opt.id}
          aria-controls={`submit-mode-${opt.id}`}
          tabIndex={mode === opt.id ? 0 : -1}
          onClick={() => setMode(opt.id)}
          className={`group flex flex-col items-start gap-0.5 rounded-full px-4 py-2.5 text-left transition-colors ${
            mode === opt.id
              ? "bg-paper text-ink ring-1 ring-ink/15"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
            {opt.eyebrow}
          </span>
          <span className="text-sm font-medium">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ===========================================================
   EVENT BY URL — single event extraction + edit + submit
   =========================================================== */

function EventByUrl() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "extracting" | "ready" | "extract-error" | "submitting" | "submitted" | "submit-error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<string | null>(null);
  const [event, setEvent] = useState<ExtractedEvent | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  async function extract() {
    setStatus("extracting");
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as ExtractResponse;
      if (!data.ok) {
        setStatus("extract-error");
        setError(data.error ?? "Extraction failed");
        setHint(data.hint ?? null);
        setAdapter(data.adapter ?? null);
        return;
      }
      setAdapter(data.adapter ?? null);
      setEvent(data.events?.[0] ?? null);
      setStatus("ready");
    } catch {
      setStatus("extract-error");
      setError("Network error");
    }
  }

  async function submit() {
    if (!event) return;
    setStatus("submitting");
    setError(null);
    try {
      const payload = {
        title: event.title,
        description: event.description || undefined,
        link: event.link,
        startsAt: event.startsAt,
        endsAt: event.endsAt || undefined,
        isOnline: event.isOnline,
        venueName: event.venueName || undefined,
        address: event.address || undefined,
        city: event.city || undefined,
        state: event.state || "UT",
        postalCode: event.postalCode || undefined,
        tags: event.tags?.length ? event.tags : undefined,
        submitterName: submitterName || undefined,
        submitterEmail: submitterEmail || undefined,
      };
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus("submit-error");
        setError(data.error ?? "Submission failed");
        return;
      }
      setStatus("submitted");
    } catch {
      setStatus("submit-error");
      setError("Network error");
    }
  }

  if (status === "submitted") {
    return (
      <div className="rounded-2xl border border-sage-deep/40 bg-paper p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
          In the queue
        </p>
        <h3 className="mt-2 font-display italic tracking-tight text-2xl text-ink"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}>
          Thanks. We&apos;ll take a look.
        </h3>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed">
          Every submission gets a quick human review before it lands on the
          public schedule. Most clear within a day.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Event URL
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://lu.ma/your-event"
            disabled={status === "extracting"}
            className="mt-2 w-full rounded-xl bg-paper-deep px-4 py-3 text-base text-ink ring-1 ring-ink/15 placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-sunset-deep"
          />
        </label>
        <p className="mt-2 text-xs text-ink-soft text-pretty">
          Luma, Eventbrite, Meetup, Silicon Slopes, or any conference page with
          schema.org event markup. We&apos;ll pull the title, date, venue
          automatically.
        </p>
      </div>

      <button
        type="button"
        onClick={extract}
        disabled={!url || status === "extracting"}
        className="self-start inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50 hover:bg-sunset-deep transition-colors"
      >
        {status === "extracting" ? "Extracting…" : "Extract event"}
        <span aria-hidden>→</span>
      </button>

      {status === "extract-error" && (
        <div className="rounded-xl border border-sunset-deep/30 bg-paper p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
            Couldn&apos;t extract
          </p>
          <p className="mt-1.5 text-sm text-ink">{error}</p>
          {hint && <p className="mt-2 text-xs text-ink-soft leading-relaxed">{hint}</p>}
          {adapter && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              Tried: {adapter}
            </p>
          )}
        </div>
      )}

      {(status === "ready" || status === "submitting" || status === "submit-error") && event && (
        <ExtractedPreview
          event={event}
          adapter={adapter}
          onChange={setEvent}
          submitterName={submitterName}
          submitterEmail={submitterEmail}
          onSubmitterName={setSubmitterName}
          onSubmitterEmail={setSubmitterEmail}
          onSubmit={submit}
          submitting={status === "submitting"}
        />
      )}

      {status === "submit-error" && (
        <div className="rounded-xl border border-sunset-deep/30 bg-paper p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
            Submit failed
          </p>
          <p className="mt-1.5 text-sm text-ink">{error}</p>
        </div>
      )}
    </div>
  );
}

function ExtractedPreview({
  event,
  adapter,
  onChange,
  submitterName,
  submitterEmail,
  onSubmitterName,
  onSubmitterEmail,
  onSubmit,
  submitting,
}: {
  event: ExtractedEvent;
  adapter: string | null;
  onChange: (e: ExtractedEvent) => void;
  submitterName: string;
  submitterEmail: string;
  onSubmitterName: (v: string) => void;
  onSubmitterEmail: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  function patch(p: Partial<ExtractedEvent>) {
    onChange({ ...event, ...p });
  }
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-paper-deep p-5 ring-1 ring-ink/10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
          Found it. Adjust if needed.
        </p>
        {adapter && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            via {adapter}
          </p>
        )}
      </div>

      <Field label="Title" value={event.title} onChange={(v) => patch({ title: v })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Starts"
          type="datetime-local"
          value={event.startsAt}
          onChange={(v) => patch({ startsAt: v })}
        />
        <Field
          label="Ends (optional)"
          type="datetime-local"
          value={event.endsAt}
          onChange={(v) => patch({ endsAt: v })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Venue"
          value={event.venueName}
          onChange={(v) => patch({ venueName: v })}
        />
        <Field label="City" value={event.city} onChange={(v) => patch({ city: v })} />
      </div>
      <Field
        label="Address"
        value={event.address}
        onChange={(v) => patch({ address: v })}
      />
      <Field
        label="Description"
        value={event.description}
        onChange={(v) => patch({ description: v })}
        multiline
      />

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={event.isOnline}
          onChange={(e) => patch({ isOnline: e.target.checked })}
          className="size-4"
        />
        Online event
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-ink/12 pt-5">
        <Field
          label="Your name (optional)"
          value={submitterName}
          onChange={onSubmitterName}
        />
        <Field
          label="Your email (optional)"
          type="email"
          value={submitterEmail}
          onChange={onSubmitterEmail}
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !event.title || !event.startsAt}
        className="self-start inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50 hover:bg-sunset-deep transition-colors"
      >
        {submitting ? "Submitting…" : "Submit for review"}
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

/* ===========================================================
   SOURCE BY URL — suggest a whole calendar / feed
   =========================================================== */

function SourceByUrl() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/submit-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          note,
          submitterName: submitterName || undefined,
          submitterEmail: submitterEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus("error");
        setError(data.error ?? "Submission failed");
        return;
      }
      setStatus("submitted");
    } catch {
      setStatus("error");
      setError("Network error");
    }
  }

  if (status === "submitted") {
    return (
      <div className="rounded-2xl border border-sage-deep/40 bg-paper p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sage-deep">
          On the list
        </p>
        <h3 className="mt-2 font-display italic tracking-tight text-2xl text-ink"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}>
          Thanks for the lead.
        </h3>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed">
          We&apos;ll check the calendar, wire up the scraper, and the events
          will start showing up on the schedule. If we hit a snag, we&apos;ll
          ping you at the email above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Calendar / source URL
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.meetup.com/your-group/"
            className="mt-2 w-full rounded-xl bg-paper-deep px-4 py-3 text-base text-ink ring-1 ring-ink/15 placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-sunset-deep"
          />
        </label>
        <p className="mt-2 text-xs text-ink-soft text-pretty">
          A Meetup group, a Luma calendar, an Eventbrite organizer page, a
          conference site, an org&apos;s events page. Anything that posts
          recurring Utah tech events.
        </p>
      </div>

      <Field
        label="What is it? (optional)"
        value={note}
        onChange={setNote}
        multiline
        placeholder="e.g. monthly meetup, annual conference, weekly newsletter…"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-ink/12 pt-5">
        <Field
          label="Your name (optional)"
          value={submitterName}
          onChange={setSubmitterName}
        />
        <Field
          label="Your email (optional)"
          type="email"
          value={submitterEmail}
          onChange={setSubmitterEmail}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!url || status === "submitting"}
        className="self-start inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50 hover:bg-sunset-deep transition-colors"
      >
        {status === "submitting" ? "Submitting…" : "Suggest this source"}
        <span aria-hidden>→</span>
      </button>

      {status === "error" && (
        <div className="rounded-xl border border-sunset-deep/30 bg-paper p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-sunset-deep">
            Submit failed
          </p>
          <p className="mt-1.5 text-sm text-ink">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   Shared field
   =========================================================== */

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1.5 w-full rounded-lg bg-paper px-3 py-2 text-sm text-ink ring-1 ring-ink/12 placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-sunset-deep"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-lg bg-paper px-3 py-2 text-sm text-ink ring-1 ring-ink/12 placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-sunset-deep"
        />
      )}
    </label>
  );
}
