"use client";

import { useState } from "react";

export function EmailSignup() {
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
        body: JSON.stringify({ email: email.trim(), website }),
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

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {/* Honeypot - real users won't see this */}
      <label
        htmlFor="ets-website"
        className="sr-only"
        aria-hidden
      >
        Website
        <input
          id="ets-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
        />
      </label>

      {state === "ok" ? (
        <p className="rounded-md border-l-[3px] border-sage-deep bg-sage/[0.08] px-4 py-3 text-sm text-ink">
          Check your inbox - we sent a one-click confirmation link.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-full border border-ink/20 bg-paper px-5 py-3 text-base outline-none focus:border-ink focus:ring-0"
            disabled={state === "loading"}
          />
          <button
            type="submit"
            disabled={state === "loading" || !email}
            className="rounded-full bg-ink px-6 py-3 text-base font-medium text-paper hover:bg-ink/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "loading" ? "Sending…" : "Subscribe"}
          </button>
        </div>
      )}

      {state === "error" && (
        <p className="text-sm text-sunset-deep">{error}</p>
      )}
      {state !== "ok" && (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          One email a week · Monday morning · unsubscribe anytime
        </p>
      )}
    </form>
  );
}
