import crypto from "node:crypto";

export interface ModerationToken {
  submissionId: string;
  action: "approve" | "reject";
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

export function createToken(submissionId: string, action: "approve" | "reject", ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: ModerationToken = {
    submissionId,
    action,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadStr = b64url(JSON.stringify(payload));
  const sig = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

export function verifyToken(token: string): ModerationToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = sign(payloadStr);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  let parsed: ModerationToken;
  try {
    parsed = JSON.parse(b64urlDecode(payloadStr).toString("utf8"));
  } catch {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  if (parsed.action !== "approve" && parsed.action !== "reject") return null;
  return parsed;
}
