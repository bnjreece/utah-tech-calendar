"use client";

import { useEffect, useMemo, useState } from "react";
import { UTAH_REGIONS, type UtahRegion } from "@/lib/regions";
import {
  filtersToSearchParams,
  SOURCE_LABELS,
  TYPE_LABELS,
  type FilterState,
  type EventType,
} from "@/lib/filters";
import { MultiSelectPopover } from "@/components/multi-select-popover";
import { SubscribePopover } from "@/components/subscribe-popover";
import { SITE_URL } from "@/lib/seo";

interface CountedOption {
  value: string;
  count: number;
}

interface Props {
  cities: CountedOption[];
  tags: CountedOption[];
  sources: CountedOption[];
}

const EMPTY: FilterState = {
  q: "",
  regions: [],
  cities: [],
  tags: [],
  sources: [],
  groups: [],
  types: [],
  showOnline: false,
};

const TYPES: EventType[] = ["conference", "paid", "free", "penciled"];

/* Build a subscription URL by composing the same filters the schedule
   page uses. State is local - no router push - so the user can iterate
   without bouncing the schedule view. The resulting query string feeds
   the SubscribePopover, which already knows how to deeplink to Apple
   Calendar (webcal://), Google Calendar (?cid=), and how to expose
   raw iCal/RSS URLs. */
export function FeedBuilder({ cities, tags, sources }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  const [count, setCount] = useState<number | null>(null);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);

  const feedQuery = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);

  /* Debounced live count via the /api/feed/count endpoint. 250ms is
     enough to avoid hammering on rapid chip clicks while still feeling
     responsive. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/feed/count${feedQuery ? `?${feedQuery}` : ""}`);
        const json = (await res.json()) as { count: number; capped: boolean };
        if (cancelled) return;
        setCount(json.count);
        setCapped(json.capped);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [feedQuery]);

  const activeCount =
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    filters.sources.length +
    filters.types.length +
    (filters.showOnline ? 1 : 0);

  function toggleRegion(r: UtahRegion) {
    setFilters((f) =>
      f.regions.includes(r)
        ? { ...f, regions: f.regions.filter((x) => x !== r) }
        : { ...f, regions: [...f.regions, r] },
    );
  }

  function toggleType(t: EventType) {
    setFilters((f) =>
      f.types.includes(t)
        ? { ...f, types: f.types.filter((x) => x !== t) }
        : { ...f, types: [...f.types, t] },
    );
  }

  const cityOptions = cities.map((c) => ({ value: c.value, label: c.value, count: c.count }));
  const tagOptions = tags.map((t) => ({ value: t.value, label: t.value, count: t.count }));
  const sourceOptions = sources.map((s) => ({
    value: s.value,
    label: SOURCE_LABELS[s.value] ?? s.value,
    count: s.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Region chips - fixed list of 5, no dropdown needed */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">
          Regions
        </p>
        <div className="flex flex-wrap gap-2">
          {UTAH_REGIONS.filter((r) => r !== "Unknown").map((r) => {
            const on = filters.regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRegion(r)}
                aria-pressed={on}
                className={
                  on
                    ? "rounded-full bg-ink text-paper px-3 py-1.5 text-sm font-medium"
                    : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dropdowns for the dynamic dimensions */}
      <div className="flex flex-wrap gap-3">
        <MultiSelectPopover
          label="Cities"
          options={cityOptions}
          selected={filters.cities}
          onChange={(v) => setFilters((f) => ({ ...f, cities: v }))}
          searchable
        />
        <MultiSelectPopover
          label="Tags"
          options={tagOptions}
          selected={filters.tags}
          onChange={(v) => setFilters((f) => ({ ...f, tags: v }))}
          searchable
        />
        <MultiSelectPopover
          label="Sources"
          options={sourceOptions}
          selected={filters.sources}
          onChange={(v) => setFilters((f) => ({ ...f, sources: v }))}
        />
      </div>

      {/* Type chips + online toggle */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                aria-pressed={on}
                className={
                  on
                    ? "rounded-full bg-ink text-paper px-3 py-1.5 text-sm font-medium"
                    : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
                }
              >
                {TYPE_LABELS[t]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, showOnline: !f.showOnline }))}
            aria-pressed={filters.showOnline}
            className={
              filters.showOnline
                ? "rounded-full bg-dusk-deep text-paper px-3 py-1.5 text-sm font-medium"
                : "rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
            }
          >
            {filters.showOnline ? "Online: included" : "Online: hidden"}
          </button>
        </div>
      </div>

      {/* Live count + reset */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-ink/15">
        <div>
          <p className="font-display text-2xl italic tracking-tight">
            {count === null ? (
              <span className="text-ink-soft">…</span>
            ) : (
              <>
                {count}
                {capped && "+"} event{count === 1 ? "" : "s"} match
              </>
            )}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mt-1">
            {loading ? "Updating…" : activeCount === 0 ? "No filters - everything" : `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`}
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink underline decoration-1 underline-offset-4"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Three delivery channels for the same filter slice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="border border-ink/15 rounded-2xl p-5 bg-paper flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Calendar
          </p>
          <h3 className="mt-2 font-display text-xl italic tracking-tight">
            Pipe it into your calendar.
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed flex-1">
            Apple Calendar, Google Calendar, or any reader that speaks iCal.
            Updates as soon as we scrape.
          </p>
          <div className="mt-4">
            <SubscribePopover
              feedQuery={feedQuery}
              triggerLabel="Subscribe to this view"
              variant="card"
            />
          </div>
        </div>
        <div className="border border-ink/15 rounded-2xl p-5 bg-paper flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Email
          </p>
          <h3 className="mt-2 font-display text-xl italic tracking-tight">
            Or get it Monday mornings.
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed flex-1">
            A weekly email of just these events. Same filters, every Monday.
          </p>
          <div className="mt-4">
            <EmailSignupInline feedQuery={feedQuery} />
          </div>
        </div>
        <div className="border border-ink/15 rounded-2xl p-5 bg-paper flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            RSS
          </p>
          <h3 className="mt-2 font-display text-xl italic tracking-tight">
            Or read it in your feed reader.
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed flex-1">
            Feedly, NetNewsWire, Reeder, Inoreader, whatever you already
            use. Same filters, syndicated.
          </p>
          <div className="mt-4">
            <RssSubscribe feedQuery={feedQuery} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* RSS-specific subscribe card. Surfaces a copy-to-clipboard URL plus
   Feedly's one-click subscribe deeplink. Stays inside FeedBuilder so it
   reacts to the current filter state.

   Origin is anchored to SITE_URL (the canonical production host) on
   both SSR and CSR so the rendered <a href> is real from the first
   paint - no empty href flash, no hydration mismatch. In local dev
   that means the copy/Feedly URLs point at the prod domain rather
   than localhost, which is correct: a Feedly subscription to a
   localhost RSS feed would never work anyway. */
function RssSubscribe({ feedQuery }: { feedQuery: string }) {
  const [copied, setCopied] = useState(false);

  const rssUrl = `${SITE_URL}/api/rss${feedQuery ? `?${feedQuery}` : ""}`;
  const feedlyUrl = `https://feedly.com/i/subscription/feed/${encodeURIComponent(rssUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - fall back to the visible URL */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={feedlyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/85 text-center"
      >
        Add to Feedly
      </a>
      <button
        type="button"
        onClick={copy}
        className="rounded-full border border-ink/20 bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-ink"
      >
        {copied ? "URL copied" : "Copy RSS URL"}
      </button>
    </div>
  );
}

/* Inlined email signup that carries the current feedQuery to the
   subscribe API so the user's filter slice is what they get emailed.
   Kept here (rather than as a separate file) because the standalone
   EmailSignup component is no longer rendered anywhere else. */
function EmailSignupInline({ feedQuery }: { feedQuery: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), feedQuery, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setState("error");
        setError(json.error || "Couldn't subscribe");
        return;
      }
      setState("ok");
      setEmail("");
    } catch {
      setState("error");
      setError("Network error - try again");
    }
  }

  if (state === "ok") {
    return (
      <p className="rounded-md border-l-[3px] border-sage-deep bg-sage/[0.08] px-3 py-2 text-sm text-ink">
        Check your inbox for the one-click confirm.
        {feedQuery && (
          <span className="block mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            With current filters
          </span>
        )}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      {/* aria-hidden honeypot - removed from the accessibility tree, so
          a screen reader user never sees or tabs into it. */}
      <span aria-hidden style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </span>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 rounded-full border border-ink/20 bg-paper px-4 py-2.5 text-sm outline-none focus:border-ink"
          disabled={state === "loading"}
        />
        <button
          type="submit"
          disabled={state === "loading" || !email}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "loading" ? "Sending…" : "Email me"}
        </button>
      </div>
      {state === "error" && <p className="text-xs text-sunset-deep">{error}</p>}
    </form>
  );
}
