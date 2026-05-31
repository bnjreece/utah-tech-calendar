import Link from "next/link";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { verifySubscriptionTokenDetailed } from "@/lib/subscription-token";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm subscription · Utah Tech Calendar" };

type Outcome = "ok" | "already" | "expired" | "invalid" | "error";

async function consume(tokenStr: string): Promise<Outcome> {
  const r = verifySubscriptionTokenDetailed(tokenStr);
  if (!r.ok) {
    return r.reason === "expired" ? "expired" : "invalid";
  }
  if (r.payload.kind !== "verify") return "invalid";
  try {
    /* Conditional UPDATE so a fast double-click yields one row updated
       and one no-op; we branch on rowcount rather than the read+write
       race in the previous version. */
    const updated = await db
      .update(emailSubscriptions)
      .set({ verifiedAt: new Date(), unsubscribedAt: null })
      .where(and(eq(emailSubscriptions.id, r.payload.subscriptionId), isNull(emailSubscriptions.verifiedAt)))
      .returning({ id: emailSubscriptions.id });
    if (updated.length > 0) return "ok";
    /* No row updated: either already verified or row doesn't exist.
       Disambiguate with a follow-up read. */
    const [row] = await db
      .select({ id: emailSubscriptions.id })
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, r.payload.subscriptionId))
      .limit(1);
    return row ? "already" : "invalid";
  } catch (err) {
    console.warn("[verify] db error", err);
    return "error";
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await consume(token);

  const heading =
    result === "ok" ? "You're in." :
    result === "already" ? "Already confirmed." :
    result === "expired" ? "This link expired." :
    result === "invalid" ? "Link not recognized." :
    "Something broke.";
  const body =
    result === "ok"
      ? "The weekly digest of in-person Utah tech events will land in your inbox each Monday morning."
      : result === "already"
        ? "This email is already subscribed - nothing to do. Watch your inbox Monday morning."
        : result === "expired"
          ? "Confirmation links expire after seven days. Resubscribe to get a fresh link."
          : result === "invalid"
            ? "We can't make sense of this link. Resubscribe to get a fresh one, or ping b@bnjmn.org if you keep seeing this."
            : "We hit a database error confirming this. Try again in a minute, or ping b@bnjmn.org.";

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-20">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Subscribe
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        {heading}
      </h1>
      <p className="mt-4 max-w-[58ch] text-pretty text-ink-soft leading-relaxed">
        {body}
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-base sm:px-5 sm:py-2.5 sm:text-sm font-medium text-paper hover:bg-ink/85"
        >
          See this week's schedule
        </Link>
        <Link
          href="/subscribe"
          className="inline-flex items-center text-sm text-ink-soft hover:text-ink underline underline-offset-4"
        >
          Subscribe page
        </Link>
      </div>
    </div>
  );
}
