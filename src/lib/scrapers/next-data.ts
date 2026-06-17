import * as cheerio from "cheerio";
import { safeFetchHtml } from "@/lib/safe-fetch";

export async function fetchHtml(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<string> {
  /* Every adapter that fetches a source-row URL (Meetup, Luma,
     Eventbrite, htmlCalendar, utahGeekEvents) routes through here.
     Source URLs can originate from community submissions, so this is
     an SSRF surface: an approved source pointing at 169.254.169.254 /
     a private host / a public host that 302s internal must NOT be
     fetched blindly. safeFetchHtml DNS-resolves and rejects private/
     reserved addresses, follows redirects manually re-validating each
     hop (defeats DNS rebinding), caps the body at 2 MB, and times out
     - exactly the protection /api/extract already relies on. Errors
     here are captured per-source by recordRun + last_error. */
  return safeFetchHtml(url, opts);
}

export function extractNextData<T = unknown>(html: string): T | null {
  const $ = cheerio.load(html);
  const raw = $('script#__NEXT_DATA__').first().text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  const out: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // skip malformed JSON-LD
    }
  });
  return out;
}
