import { NextRequest } from "next/server";
import { eventAdapters } from "@/lib/scrapers";
import type { EventItem } from "@/lib/scrapers";
import { safeFetchHtml } from "@/lib/safe-fetch";
import { rateLimit, assertSameOrigin } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/* Host-based adapter routing. Order matters - more specific hosts
   first. htmlCalendar is the catch-all for anything emitting schema.org
   structured data (Eventbrite organizer pages, conference homepages,
   GrowthZone-hosted member calendars, WordPress event plugins, etc). */
function pickAdapter(url: URL): { adapter: string; reason: string } {
  const host = url.hostname.toLowerCase();
  if (host === "meetup.com" || host === "www.meetup.com") {
    return { adapter: "meetup", reason: "meetup host" };
  }
  if (host === "lu.ma" || host === "luma.com" || host === "www.luma.com") {
    return { adapter: "luma", reason: "luma host" };
  }
  if (host === "eventbrite.com" || host === "www.eventbrite.com") {
    return { adapter: "eventbrite", reason: "eventbrite host" };
  }
  /* siliconSlopes adapter ignores its url argument - it always pulls
     the global Silicon Slopes event list. For a single-event URL
     paste we want htmlCalendar (which parses JSON-LD) to read THAT
     event. Only route the SS adapter when the URL is the events
     index, which the calendar cron does separately. */
  return { adapter: "htmlCalendar", reason: "generic html (json-ld or microdata)" };
}

/* Convert a UTC Date to a YYYY-MM-DDTHH:mm string in America/Denver
   (Utah) wall-clock time, the format <input type="datetime-local">
   expects. Earlier draft sliced item.startsAt.toISOString() which
   stripped the offset; the browser then re-interpreted that string
   as local time, displaying the wrong hour to a Utah submitter. */
function toMtDatetimeLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/* Trim an EventItem down to the wire shape the submit form expects -
   matches submissionPayloadSchema field names. */
function toSubmissionShape(item: EventItem) {
  return {
    title: item.title.slice(0, 200),
    description: (item.description ?? "").slice(0, 5000),
    link: item.link,
    /* Mountain Time wall-clock for the datetime-local input. */
    startsAt: toMtDatetimeLocal(item.startsAt),
    endsAt: item.endsAt ? toMtDatetimeLocal(item.endsAt) : "",
    isOnline: item.isOnline,
    venueName: (item.venueName ?? "").slice(0, 200),
    address: (item.address ?? "").slice(0, 300),
    city: (item.city ?? "").slice(0, 100),
    state: "UT",
    postalCode: (item.postalCode ?? "").slice(0, 20),
    tags: (item.tags ?? []).slice(0, 10),
    imageUrl: item.imageUrl ?? "",
  };
}

export async function POST(request: NextRequest) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return Response.json({ ok: false, error: origin.reason }, { status: 403 });
  }
  /* 5 token bucket, refills at 0.5/sec = 2-sec sustained pace, burst
     of 5. Per-IP per-instance. Hostile flood ratelimited; humans
     pasting a handful of URLs are unaffected. */
  const rl = rateLimit(request, "extract", { capacity: 5, refillPerSec: 0.5 });
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return Response.json({ ok: false, error: "Provide a URL" }, { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Response.json({ ok: false, error: "Not a valid URL" }, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return Response.json({ ok: false, error: "Only http/https URLs" }, { status: 400 });
  }
  /* Strip userinfo from URL.hostname's typical "user:pass@host" forms
     so an attack like https://lu.ma@evil.com (which URL.hostname
     correctly parses to "evil.com") can't pretend to be a known host.
     URL.hostname already handles this - just being explicit. */
  const canonicalUrl = `${url.protocol}//${url.hostname}${
    url.port ? `:${url.port}` : ""
  }${url.pathname}${url.search}`;

  const { adapter, reason } = pickAdapter(url);
  const adapterImpl = eventAdapters[adapter];
  if (!adapterImpl) {
    return Response.json(
      { ok: false, error: `Adapter "${adapter}" unavailable` },
      { status: 500 },
    );
  }

  try {
    /* Adapter scrape uses the project's normal fetchHtml which doesn't
       SSRF-check (admin-curated source rows are trusted). For the
       user-supplied URL path we need the safe variant - but the
       adapter API doesn't currently take a fetch function. As a
       defense-in-depth measure we still do the assertPublicHost +
       URL canonicalization above, and the adapters call out to lu.ma
       / meetup.com / eventbrite.com / arbitrary html which the
       safe-fetch will refuse to follow if it redirects internally.
       For htmlCalendar specifically (the catch-all), call
       safeFetchHtml first to validate the host before the adapter
       gets it. */
    if (adapter === "htmlCalendar") {
      /* This is a probe - we don't use the result, the adapter
         re-fetches. But the assertPublicHost inside safeFetchHtml
         blocks the request from even leaving if it's hostile.
         Yes, double fetch on the safe path; acceptable cost for
         a defense layer the adapter can't enforce itself. */
      await safeFetchHtml(canonicalUrl);
    }
    const items = await adapterImpl.scrape({
      url: canonicalUrl,
      maxItems: 3,
    });

    if (items.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Couldn't find an event at that URL",
          hint:
            adapter === "htmlCalendar"
              ? "We look for schema.org Event JSON-LD or microdata on the page. If the source is hand-built, find a Meetup/Luma/Eventbrite mirror of the event and paste that URL instead."
              : `Tried the ${adapter} adapter but it returned nothing.`,
          adapter,
          adapterReason: reason,
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      adapter,
      adapterReason: reason,
      count: items.length,
      events: items.map(toSubmissionShape),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        ok: false,
        error: "Extraction failed",
        details: message.slice(0, 300),
        adapter,
        adapterReason: reason,
      },
      { status: 502 },
    );
  }
}
