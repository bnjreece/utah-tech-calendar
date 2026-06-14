import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, pendingSubmissions, events } from "@/lib/db";
import { verifyToken } from "@/lib/moderation";
import { recordSubmissionDecision } from "@/lib/review-log";
import type { SubmissionPayload } from "@/lib/submission-payload";

export const dynamic = "force-dynamic";

export default async function ModeratePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = verifyToken(token);

  if (!decoded) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invalid or expired link</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Token verification failed.
        </p>
      </div>
    );
  }

  const [submission] = await db
    .select()
    .from(pendingSubmissions)
    .where(eq(pendingSubmissions.id, decoded.submissionId))
    .limit(1);

  if (!submission) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Submission not found</h1>
      </div>
    );
  }

  if (submission.status !== "pending") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">
          Already {submission.status}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          This submission was reviewed on{" "}
          {submission.reviewedAt?.toLocaleString() ?? "an earlier date"}.
        </p>
      </div>
    );
  }

  const payload = submission.payload as SubmissionPayload;

  /* Atomically claim the submission before doing any work. The token is a
     stateless 7-day HMAC (verified, not consumed), so a prefetch / double-
     click can fire two concurrent requests that both pass the in-memory
     guard above. Gating on `status = 'pending'` in the UPDATE means only
     the request that actually flips the row proceeds to insert + log; the
     loser sees "Already reviewed" instead of double-publishing. */
  const [claimed] = await db
    .update(pendingSubmissions)
    .set({
      status: decoded.action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(pendingSubmissions.id, submission.id),
        eq(pendingSubmissions.status, "pending"),
      ),
    )
    .returning({ id: pendingSubmissions.id });

  if (!claimed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Already reviewed</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This submission was just handled by another request.
        </p>
      </div>
    );
  }

  let publishedEventId: string | null = null;
  if (decoded.action === "approve") {
    const startsAt = new Date(payload.startsAt);
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
    const [inserted] = await db
      .insert(events)
      .values({
        title: payload.title,
        description: payload.description,
        link: payload.link,
        source: "manual",
        externalId: submission.id,
        startsAt,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
        isOnline: payload.isOnline,
        venueName: payload.venueName,
        address: payload.address,
        city: payload.city,
        state: payload.state ?? "UT",
        postalCode: payload.postalCode,
        tags: payload.tags,
        status: "approved",
      })
      .returning({ id: events.id });
    publishedEventId = inserted.id;
  }

  await recordSubmissionDecision(
    submission,
    decoded.action === "approve" ? "approve" : "reject",
    {
      subjectType: "submission_event",
      newStatus: decoded.action === "approve" ? "approved" : "rejected",
      decidedBy: "magic-link",
      channel: "magic-link",
    },
  );

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">
        {decoded.action === "approve" ? "Approved and published" : "Rejected"}
      </h1>
      <p className="text-sm text-muted-foreground mt-2">{payload.title}</p>
      {publishedEventId && (
        <Link
          href={`/event/${publishedEventId}`}
          className="text-sm underline mt-4 inline-block"
        >
          View event →
        </Link>
      )}
    </div>
  );
}
