import { NextRequest } from "next/server";
import { eventAdapters } from "@/lib/scrapers";
import type { EventItem } from "@/lib/scrapers";

export const runtime = "nodejs";
export const maxDuration = 30;

/* Host-based adapter routing. Order matters - more specific hosts
   first. htmlCalendar is the catch-all for anything emitting schema.org
   structured data (Eventbrite organizer pages, conference homepages,
   GrowthZone-hosted member calendars, WordPress event plugins, etc). */
function pickAdapter(rawUrl: string): { adapter: string; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { adapter: "htmlCalendar", reason: "fallback" };
  }
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
  if (host === "siliconslopes.com" || host === "www.siliconslopes.com") {
    return { adapter: "siliconSlopes", reason: "silicon slopes host" };
  }
  return { adapter: "htmlCalendar", reason: "generic html (json-ld or microdata)" };
}

/* Trim an EventItem down to the wire shape the submit form expects -
   matches submissionPayloadSchema field names. */
function toSubmissionShape(item: EventItem) {
  return {
    title: item.title,
    description: item.description ?? "",
    link: item.link,
    /* ISO datetime - browser <input type="datetime-local"> needs
       YYYY-MM-DDTHH:mm (no seconds, no timezone). */
    startsAt: item.startsAt.toISOString().slice(0, 16),
    endsAt: item.endsAt ? item.endsAt.toISOString().slice(0, 16) : "",
    isOnline: item.isOnline,
    venueName: item.venueName ?? "",
    address: item.address ?? "",
    city: item.city ?? "",
    state: "UT",
    postalCode: item.postalCode ?? "",
    tags: item.tags ?? [],
    imageUrl: item.imageUrl ?? "",
  };
}

export async function POST(request: NextRequest) {
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

  const { adapter, reason } = pickAdapter(rawUrl);
  const adapterImpl = eventAdapters[adapter];
  if (!adapterImpl) {
    return Response.json(
      { ok: false, error: `Adapter "${adapter}" unavailable` },
      { status: 500 },
    );
  }

  try {
    /* maxItems=3 because a few extractors return all events on a
       calendar page when the URL is the calendar root - the user
       expected one event so we surface the first AND let them pick
       from the next two if the first isn't what they meant. */
    const items = await adapterImpl.scrape({
      url: rawUrl,
      maxItems: 3,
    });

    if (items.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Couldn't find an event at that URL",
          hint:
            adapter === "htmlCalendar"
              ? "We look for schema.org Event JSON-LD or microdata. If the page is hand-built, try the source's Meetup/Luma/Eventbrite mirror, or fill in the form manually below."
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
