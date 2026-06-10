import * as cheerio from "cheerio";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchHtml(url: string): Promise<string> {
  /* 20s hard timeout. Node's fetch has no default timeout, so without
     this a single hung host (Meetup/Luma/Eventbrite/htmlCalendar all
     route through here) holds a scrape worker until the cron's 300s
     maxDuration, starving the rest of the sweep. The timeout converts
     "host is hanging" into a clean per-source error that recordRun +
     last_error capture, instead of a budget blowout. */
  const res = await fetch(url, {
    headers: COMMON_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} → HTTP ${res.status}`);
  }
  return res.text();
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
