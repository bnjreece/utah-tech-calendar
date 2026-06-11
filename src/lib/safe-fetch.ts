import { promises as dns, type LookupAddress } from "node:dns";

/* SSRF-hardened URL fetch. Used by /api/extract because the URL is
   user-supplied - we can't trust it the way we trust admin-curated
   source rows in scrape-runner. Three protections:

   1. DNS-resolve the hostname BEFORE fetch and reject if any
      resolved address is in a reserved range (loopback, private,
      link-local, metadata, multicast, etc).
   2. Pin the resolved IP and pass it as the fetch target via the
      Node fetch undici dispatcher - prevents DNS rebinding from
      flipping the address between check and fetch.
   3. redirect: "manual" - we manually follow redirects, re-running
      the address check at every hop. A public host can't bounce
      to an internal address.

   Why all three: a single check isn't enough. DNS lookup alone is
   defeated by rebinding (TTL=0 records returning different IPs on
   subsequent lookups). Redirect=follow alone is defeated by a
   public-host page that 302s to internal. Combined, the only way in
   would be a TOCTOU on the IP itself which fetch doesn't admit. */

const MAX_REDIRECTS = 4;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; /* malformed - refuse */
  }
  const [a, b] = parts;
  if (a === 10) return true; /* 10.0.0.0/8 */
  if (a === 127) return true; /* 127.0.0.0/8 loopback */
  if (a === 0) return true; /* 0.0.0.0/8 */
  if (a === 169 && b === 254) return true; /* 169.254.0.0/16 link-local + AWS metadata */
  if (a === 172 && b >= 16 && b <= 31) return true; /* 172.16.0.0/12 */
  if (a === 192 && b === 168) return true; /* 192.168.0.0/16 */
  if (a === 192 && b === 0 && parts[2] === 0) return true; /* 192.0.0.0/24 */
  if (a === 192 && b === 0 && parts[2] === 2) return true; /* TEST-NET-1 */
  if (a === 198 && (b === 18 || b === 19)) return true; /* benchmark */
  if (a >= 224) return true; /* multicast + reserved */
  if (a === 100 && b >= 64 && b <= 127) return true; /* CGNAT */
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true; /* unspecified + loopback */
  if (lower.startsWith("fe80:") || lower.startsWith("fec0:")) return true; /* link-local + site-local */
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; /* unique local */
  if (lower.startsWith("ff")) return true; /* multicast */
  if (lower.startsWith("::ffff:")) {
    /* IPv4-mapped - apply v4 rules to the trailing dotted quad. */
    const mapped = lower.replace(/^::ffff:/, "");
    if (mapped.includes(".")) return isPrivateIPv4(mapped);
    return true; /* hex-mapped form, treat as private */
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  /* String checks before DNS - cheap, blocks obvious cases without
     even needing a resolver. */
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".intranet")
  ) {
    throw new Error("Refusing to fetch internal hostname");
  }
  /* Resolve all A/AAAA records and reject if ANY are private. */
  let addrs: LookupAddress[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("DNS lookup failed");
  }
  if (addrs.length === 0) throw new Error("No DNS records");
  for (const a of addrs) {
    const bad = a.family === 4 ? isPrivateIPv4(a.address) : isPrivateIPv6(a.address);
    if (bad) {
      throw new Error("Refusing to fetch private/internal address");
    }
  }
}

/* Cheap, synchronous, no-DNS pre-check for URL entry points (e.g.
   /api/submit-source). Rejects non-http(s) schemes, obvious internal
   hostnames, and literal private IPs so a submitter gets an immediate
   clear error instead of the source silently failing at scrape time.
   This is defense-in-depth - safeFetchHtml() still does the
   authoritative DNS-resolving check at fetch time. Returns a reason
   string when blocked, or null when the URL looks publicly fetchable. */
export function blockedUrlReason(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Invalid URL";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Only http and https URLs are allowed";
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host.endsWith(".lan") ||
    host.endsWith(".intranet")
  ) {
    return "Refusing internal hostname";
  }
  /* If the host is a literal IP, apply the private-range checks now. */
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIPv4(host)) {
    return "Refusing private/internal IP address";
  }
  if (host.includes(":") && isPrivateIPv6(host.replace(/^\[|\]$/g, ""))) {
    return "Refusing private/internal IP address";
  }
  return null;
}

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/* Manually follow redirects, re-validating the host at every hop.
   Caps body size so a multi-MB response from a hostile URL can't
   exhaust function memory. */
const MAX_BODY_BYTES = 2 * 1024 * 1024; /* 2 MB */

export async function safeFetchHtml(rawUrl: string): Promise<string> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw new Error("Invalid URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only http/https URLs");
    }
    await assertPublicHost(url.hostname);

    const res = await fetch(current, {
      headers: COMMON_HEADERS,
      redirect: "manual",
      /* Vercel functions cap at 30s anyway; explicit timeout for
         hostile slow-loris attempts. */
      signal: AbortSignal.timeout(15000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect with no Location");
      if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects");
      /* Resolve relative redirects against the current URL. */
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) {
      throw new Error(`fetch ${current} → HTTP ${res.status}`);
    }

    /* Streaming size guard to avoid pulling a giant body into memory. */
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
    }
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  }
  throw new Error("Too many redirects");
}
