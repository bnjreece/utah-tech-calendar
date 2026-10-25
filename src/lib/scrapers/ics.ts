/* Minimal iCalendar (RFC 5545) reader for the feeds we scrape. Pure (no
   fetch) so it is unit tested against a saved feed. Handles what calendar
   exports actually emit: folded lines, escaped text, UTC / floating /
   TZID / all-day DTSTART values. Floating and TZID times are read as
   America/Denver wall-clock, which is right for every Utah feed we take. */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: string;
  organizerName?: string;
  start: Date;
  end?: Date;
  latitude?: number;
  longitude?: number;
}

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/* Undo line folding: a CRLF (or LF) followed by one space or tab
   continues the previous line. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

function parseLine(line: string): IcsProp | null {
  /* The value starts at the first colon that is not inside a quoted
     parameter value (ORGANIZER;CN="a:b":MAILTO:...). */
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [rawName, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: rawName.toUpperCase(), params, value };
}

/* Offset (ms) of America/Denver from UTC at a given instant. */
function denverOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

export function parseIcsDate(value: string): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return undefined;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (z) return new Date(wall);
  /* Floating / TZID / all-day: Denver wall-clock. Two passes settle the
     offset across a DST edge. */
  let utc = wall - denverOffsetMs(wall);
  utc = wall - denverOffsetMs(utc);
  return new Date(utc);
}

export function parseIcs(text: string): IcsEvent[] {
  const out: IcsEvent[] = [];
  let cur: IcsProp[] | null = null;
  /* Nested components (VALARM) inside a VEVENT are skipped. */
  let nested = 0;
  for (const line of unfold(text)) {
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      cur = [];
      nested = 0;
      continue;
    }
    if (!cur) continue;
    if (upper.startsWith("BEGIN:")) {
      nested++;
      continue;
    }
    if (upper.startsWith("END:") && nested > 0) {
      nested--;
      continue;
    }
    if (upper === "END:VEVENT") {
      const ev = toEvent(cur);
      if (ev) out.push(ev);
      cur = null;
      continue;
    }
    if (nested > 0) continue;
    const p = parseLine(line);
    if (p) cur.push(p);
  }
  return out;
}

function toEvent(props: IcsProp[]): IcsEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const uid = get("UID")?.value.trim();
  const summary = get("SUMMARY");
  const dtstart = get("DTSTART");
  if (!uid || !summary || !dtstart) return null;
  const start = parseIcsDate(dtstart.value);
  if (!start) return null;
  const dtend = get("DTEND");
  const end = dtend ? parseIcsDate(dtend.value) : undefined;
  const geo = get("GEO")?.value.split(";").map(Number);
  const hasGeo = geo && geo.length === 2 && geo.every((n) => Number.isFinite(n));
  const text = (n: string) => {
    const p = get(n);
    if (!p) return undefined;
    const v = unescapeText(p.value).trim();
    return v || undefined;
  };
  return {
    uid,
    summary: unescapeText(summary.value).trim(),
    description: text("DESCRIPTION"),
    location: text("LOCATION"),
    url: text("URL"),
    status: get("STATUS")?.value.trim().toUpperCase(),
    organizerName: get("ORGANIZER")?.params.CN || undefined,
    start,
    end,
    latitude: hasGeo ? geo[0] : undefined,
    longitude: hasGeo ? geo[1] : undefined,
  };
}
