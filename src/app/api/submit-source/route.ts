import { NextRequest } from "next/server";
import { Resend } from "resend";
import { and, eq, sql } from "drizzle-orm";
import { db, pendingSubmissions } from "@/lib/db";
import { rateLimit, assertSameOrigin } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MODERATOR_EMAIL = "b@bnjmn.org";

/* Source-suggestion submissions. Distinct from /api/submit (which
   submits a single event draft). A source is a whole calendar / feed
   the admin would register in the sources table. The pending row
   carries `type: "source"` in its payload so /admin/review can route
   it differently. */
export async function POST(request: NextRequest) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return Response.json({ ok: false, error: origin.reason }, { status: 403 });
  }
  /* Tighter than /api/extract because each call sends an email and
     writes a row. 3 in burst, sustained 1 per 5 sec. */
  const rl = rateLimit(request, "submit-source", {
    capacity: 3,
    refillPerSec: 0.2,
  });
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { url?: unknown; note?: unknown; submitterName?: unknown; submitterEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return Response.json({ ok: false, error: "URL required" }, { status: 400 });
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

  const note = typeof body.note === "string" ? body.note.slice(0, 500).trim() : "";
  const submitterName =
    typeof body.submitterName === "string" ? body.submitterName.slice(0, 100).trim() : null;
  const submitterEmail =
    typeof body.submitterEmail === "string" ? body.submitterEmail.slice(0, 200).trim() : null;

  /* Dedup: if this URL is already in the queue, return the existing
     row id silently. A bot loop can't grow the queue past one entry
     per unique URL, and an honest user retrying after a network
     blip doesn't get a duplicate review item. */
  const existing = await db
    .select({ id: pendingSubmissions.id })
    .from(pendingSubmissions)
    .where(
      and(
        eq(pendingSubmissions.status, "pending"),
        sql`${pendingSubmissions.payload}->>'url' = ${rawUrl}`,
      ),
    )
    .limit(1);
  if (existing[0]) {
    return Response.json({ ok: true, id: existing[0].id, deduped: true });
  }

  const payload = {
    /* Discriminator so admin/review can split sources from events. */
    type: "source" as const,
    url: rawUrl,
    note,
    /* Synthetic title so the admin/review row renders meaningfully
       instead of "(untitled draft)". */
    title: `Source suggestion: ${url.hostname}`,
  };

  const [row] = await db
    .insert(pendingSubmissions)
    .values({
      payload,
      submitterEmail,
      submitterName,
    })
    .returning({ id: pendingSubmissions.id });

  /* Best-effort moderator notification. Reuses Resend if configured. */
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const submitter = submitterEmail
        ? `${submitterName ?? "Anonymous"} <${submitterEmail}>`
        : (submitterName ?? "Anonymous");
      await resend.emails.send({
        from: "events@updates.bnjmn.org",
        to: MODERATOR_EMAIL,
        subject: `Source suggestion: ${url.hostname}`,
        text: [
          `New source suggestion from ${submitter}`,
          ``,
          `URL: ${rawUrl}`,
          note ? `Note: ${note}` : "",
          ``,
          `Review at https://utahtechcalendar.com/admin/review`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
  } catch {
    /* Email failure shouldn't block the submission. The row is in the
       queue and will surface in the next daily queue-digest email. */
  }

  return Response.json({ ok: true, id: row?.id ?? null });
}
