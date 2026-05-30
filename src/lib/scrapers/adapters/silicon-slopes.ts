import type { Adapter, EventItem } from "../types";

const EVENTS_URL = "https://www.siliconslopes.com/events";
const COOKIE_DOMAIN = "www.siliconslopes.com";

interface RawCard {
  href: string;
  cardText: string;
}

const MONTH: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/* Strict allow-list. An unknown TZ token returns null from parseDateLine
   so the card is skipped rather than silently stamped with the wrong
   offset (the previous default-to-MDT was wrong for any non-listed zone
   and for our own zone in winter). */
const TZ_OFFSET_MIN: Record<string, number> = {
  MST: 7 * 60,
  MDT: 6 * 60,
  PST: 8 * 60,
  PDT: 7 * 60,
  CST: 6 * 60,
  CDT: 5 * 60,
  EST: 5 * 60,
  EDT: 4 * 60,
};

function parseDateLine(line: string, which: "start" | "end" = "start"): Date | null {
  const m =
    /(\w{3,9}),\s*(\w{3})\s+(\d{1,2}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*([A-Z]{2,4})/i.exec(
      line,
    );
  if (!m) return null;
  const [, , monStr, dayStr, sHourStr, sMinStr, sAmPm, eHourStr, eMinStr, eAmPm, tz] = m;
  const month = MONTH[monStr.toLowerCase()];
  if (month === undefined) return null;

  const day = Number(dayStr);
  let sHour = Number(sHourStr);
  const sMin = Number(sMinStr);
  let eHour = Number(eHourStr);
  const eMin = Number(eMinStr);
  const finalAmPm = (eAmPm || "AM").toUpperCase();
  const startAmPm = (sAmPm || finalAmPm).toUpperCase();
  if (startAmPm === "PM" && sHour !== 12) sHour += 12;
  if (startAmPm === "AM" && sHour === 12) sHour = 0;
  if (finalAmPm === "PM" && eHour !== 12) eHour += 12;
  if (finalAmPm === "AM" && eHour === 12) eHour = 0;

  const hour = which === "start" ? sHour : eHour;
  const minute = which === "start" ? sMin : eMin;

  const offsetMin = TZ_OFFSET_MIN[tz.toUpperCase()];
  if (offsetMin === undefined) return null;
  const now = new Date();
  const year = now.getUTCFullYear();
  let utc = Date.UTC(year, month, day, hour, minute) + offsetMin * 60_000;
  /* Calendar shows the next 12 months only, so a date that lands before
     today on the current-year guess belongs in next year (e.g. scraping
     in December and seeing "Jan 5"). Stale rows (>30d in the past) are
     dropped entirely rather than bumped forward - they're historical,
     not upcoming. */
  if (utc < now.getTime() - 30 * 86_400_000) {
    const bumped = Date.UTC(year + 1, month, day, hour, minute) + offsetMin * 60_000;
    if (bumped - now.getTime() > 365 * 86_400_000) return null;
    utc = bumped;
  }
  return new Date(utc);
}

function parseCard(card: RawCard, source: string): EventItem | null {
  const lines = card.cardText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const title = lines[0];
  const dateLine = lines.find(
    (l) => /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(l) && /\d:\d\d/.test(l),
  );
  if (!dateLine) return null;

  const startsAt = parseDateLine(dateLine, "start");
  if (!startsAt) return null;
  const endsAt = parseDateLine(dateLine, "end") ?? undefined;

  const isOnline = lines.some((l) => /^virtual$/i.test(l));
  const externalId = card.href.split("/c/events/")[1]?.split(/[?#]/)[0];
  if (!externalId) return null;

  return {
    source,
    externalId,
    title,
    link: card.href,
    startsAt,
    endsAt,
    isOnline,
    venueName: isOnline ? undefined : "Silicon Slopes (see event page)",
    city: isOnline ? undefined : "Salt Lake City",
  };
}

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

  let binaryPath: string;
  let args: string[];

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    binaryPath = await chromium.executablePath();
    args = chromium.args;
  } else {
    binaryPath =
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
  }

  return puppeteer.launch({
    args,
    executablePath: binaryPath,
    headless: true,
    defaultViewport: { width: 1280, height: 1600 },
  });
}

async function extractRawCards(url: string, sessionCookie: string): Promise<RawCard[]> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.setCookie({
        name: "user_session_identifier",
        value: sessionCookie,
        domain: COOKIE_DOMAIN,
        path: "/",
        httpOnly: false,
        secure: true,
      });
    } catch {
      /* Re-raise without echoing the cookie value, which puppeteer-core
         would otherwise embed in its error message and land in the
         sources.last_error column rendered on /admin. */
      throw new Error("Failed to set session cookie - cookie format invalid");
    }
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45_000 });
    /* Race between the SPA populating event anchors and Circle showing
       the signed-out shell. We only swallow TimeoutError; any other
       error (page crash, JS exception, navigation aborted) is a real
       failure that should surface as lastError rather than 0 items. */
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll('a[href*="/c/events/"]').length > 0 ||
          document.body.innerText.includes("Sign in"),
        { timeout: 20_000 },
      )
      .catch((e: Error) => {
        if (e.name !== "TimeoutError") throw e;
      });

    const cards = await page.evaluate(() => {
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/c/events/"]'),
      );
      const seen = new Set<string>();
      const out: { href: string; cardText: string }[] = [];
      for (const a of anchors) {
        if (seen.has(a.href)) continue;
        seen.add(a.href);
        let card: HTMLElement | null = a;
        for (let i = 0; i < 6 && card; i++) {
          card = card.parentElement;
          if (!card) break;
          const t = (card.innerText || "").trim();
          if (t.length > 60 && t.length < 400) break;
        }
        out.push({
          href: a.href,
          cardText: card ? (card.innerText || "").trim().slice(0, 400) : "",
        });
      }
      return out;
    });
    return cards;
  } finally {
    /* Guard browser too - launchBrowser() can reject mid-spawn (binary
       download timeout on cold start) without ever returning a handle. */
    if (browser) await browser.close().catch(() => undefined);
  }
}

export const siliconSlopesAdapter: Adapter<EventItem> = {
  name: "siliconSlopes",
  runtime: "browser",
  async scrape({ url, maxItems = 30 }) {
    const cookie = process.env.SILICON_SLOPES_SESSION_COOKIE;
    if (!cookie) {
      throw new Error(
        "SILICON_SLOPES_SESSION_COOKIE missing - rotate via 1Password",
      );
    }
    const target = url || EVENTS_URL;
    const raws = await extractRawCards(target, cookie);
    const items: EventItem[] = [];
    const seen = new Set<string>();
    for (const r of raws) {
      const item = parseCard(r, "silicon_slopes");
      if (!item) continue;
      if (seen.has(item.externalId)) continue;
      seen.add(item.externalId);
      items.push(item);
      if (items.length >= maxItems) break;
    }
    return items;
  },
};
