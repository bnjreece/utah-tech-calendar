import crypto from "node:crypto";

/* HMAC-signed tokens for the subscriber lifecycle: a "verify" token
   confirms a new signup (double opt-in), an "unsubscribe" token lands
   the user on a one-click unsubscribe page. Signed with the same
   MODERATION_SECRET as admin moderation - a single secret to rotate. */

export type SubscriptionTokenKind = "verify" | "unsubscribe";

export interface SubscriptionToken {
  kind: SubscriptionTokenKind;
  subscriptionId: string;
  exp: number;
}

function getSecret(): string {
  const s = process.env.MODERATION_SECRET;
  if (!s) throw new Error("MODERATION_SECRET is not set");
  return s;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
}

const DEFAULT_TTL: Record<SubscriptionTokenKind, number> = {
  /* Verify tokens are short-lived - a stale signup that sat for weeks
     should be reissued, not silently confirmed. */
  verify: 60 * 60 * 24 * 7,
  /* Unsubscribe tokens last a long time - the link is embedded in every
     digest and we want the year-old footer link to still work. */
  unsubscribe: 60 * 60 * 24 * 365 * 5,
};

export function createSubscriptionToken(
  kind: SubscriptionTokenKind,
  subscriptionId: string,
  ttlSeconds?: number,
): string {
  const payload: SubscriptionToken = {
    kind,
    subscriptionId,
    exp: Math.floor(Date.now() / 1000) + (ttlSeconds ?? DEFAULT_TTL[kind]),
  };
  const payloadStr = b64url(JSON.stringify(payload));
  const sig = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

export function verifySubscriptionToken(token: string): SubscriptionToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = sign(payloadStr);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  let parsed: SubscriptionToken;
  try {
    parsed = JSON.parse(b64urlDecode(payloadStr).toString("utf8"));
  } catch {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  if (parsed.kind !== "verify" && parsed.kind !== "unsubscribe") return null;
  if (!parsed.subscriptionId) return null;
  return parsed;
}
