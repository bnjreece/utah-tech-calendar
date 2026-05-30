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

  const offsetMin = TZ_OFFSET_MIN[tz.toUpperCase()] ?? 6 * 60;
  const now = new Date();
  let year = now.getUTCFullYear();
  let utc = Date.UTC(year, month, day, hour, minute) + offsetMin * 60_000;
  if (utc < now.getTime() - 30 * 86_400_000) {
    year += 1;
    utc = Date.UTC(year, month, day, hour, minute) + offsetMin * 60_000;
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
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setCookie({
      name: "user_session_identifier",
      value: sessionCookie,
      domain: COOKIE_DOMAIN,
      path: "/",
      httpOnly: false,
      secure: true,
    });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45_000 });
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll('a[href*="/c/events/"]').length > 0 ||
          document.body.innerText.includes("Sign in"),
        { timeout: 20_000 },
      )
      .catch(() => undefined);

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
    await browser.close();
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
