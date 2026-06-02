import { NextRequest } from "next/server";
import { Resend } from "resend";
import { db, pendingSubmissions } from "@/lib/db";

export const runtime = "nodejs";

const MODERATOR_EMAIL = "b@bnjmn.org";

/* Source-suggestion submissions. Distinct from /api/submit (which
   submits a single event draft). A source is a whole calendar / feed
   the admin would register in the sources table. The pending row
   carries `type: "source"` in its payload so /admin/review can route
   it differently. */
export async function POST(request: NextRequest) {
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

  const payload = {
    /* Discriminator so admin/review can split sources from events. */
    type: "source",
    url: rawUrl,
    note,
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
        subject: `Source suggestion: ${new URL(rawUrl).hostname}`,
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
