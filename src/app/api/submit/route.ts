import { NextRequest } from "next/server";
import { Resend } from "resend";
import { db, pendingSubmissions } from "@/lib/db";
import { submissionPayloadSchema } from "@/lib/submission-payload";
import { createToken } from "@/lib/moderation";

export const runtime = "nodejs";

const MODERATOR_EMAIL = "b@bnjmn.org";

function buildBaseUrl(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submissionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const [row] = await db
    .insert(pendingSubmissions)
    .values({
      payload,
      submitterEmail: payload.submitterEmail,
      submitterName: payload.submitterName,
      status: "pending",
    })
    .returning({ id: pendingSubmissions.id });

  const base = buildBaseUrl(request);
  const approveToken = createToken(row.id, "approve");
  const rejectToken = createToken(row.id, "reject");
  const approveUrl = `${base}/moderate/${approveToken}`;
  const rejectUrl = `${base}/moderate/${rejectToken}`;

  console.log("[submit] new pending submission", { id: row.id, approveUrl, rejectUrl });

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Utah Tech Events <events@bnjmn.org>",
        to: MODERATOR_EMAIL,
        subject: `New event submission: ${payload.title}`,
        html: `
<h2>New event submission</h2>
<p><strong>${payload.title}</strong></p>
<p>${payload.description ?? ""}</p>
<p><strong>When:</strong> ${payload.startsAt}</p>
<p><strong>Where:</strong> ${payload.venueName ?? ""} ${payload.address ?? ""} ${payload.city ?? ""}</p>
<p><strong>Link:</strong> <a href="${payload.link}">${payload.link}</a></p>
<p><strong>Submitter:</strong> ${payload.submitterName ?? "(anonymous)"} ${payload.submitterEmail ? `&lt;${payload.submitterEmail}&gt;` : ""}</p>
<hr>
<p><a href="${approveUrl}" style="background:#0a0a0a;color:white;padding:8px 16px;text-decoration:none;border-radius:6px;">Approve</a> &nbsp;
<a href="${rejectUrl}" style="background:#f5f5f5;color:#0a0a0a;padding:8px 16px;text-decoration:none;border-radius:6px;">Reject</a></p>
        `,
      });
    } catch (err) {
      console.error("[submit] resend error", err);
    }
  } else {
    console.log("[submit] RESEND_API_KEY not set, skipping email. Use these links:");
    console.log("  approve:", approveUrl);
    console.log("  reject :", rejectUrl);
  }

  return Response.json({ ok: true, id: row.id });
}
