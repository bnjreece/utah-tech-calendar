import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { verifySubscriptionToken } from "@/lib/subscription-token";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm subscription · Utah Tech Events" };

async function consume(tokenStr: string): Promise<"ok" | "invalid" | "already" | "error"> {
  const payload = verifySubscriptionToken(tokenStr);
  if (!payload || payload.kind !== "verify") return "invalid";
  try {
    const [row] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, payload.subscriptionId))
      .limit(1);
    if (!row) return "invalid";
    if (row.verifiedAt && !row.unsubscribedAt) return "already";
    await db
      .update(emailSubscriptions)
      .set({ verifiedAt: new Date(), unsubscribedAt: null })
      .where(eq(emailSubscriptions.id, payload.subscriptionId));
    return "ok";
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
    result === "invalid" ? "Link expired." :
    "Something broke.";
  const body =
    result === "ok"
      ? "The weekly digest of in-person Utah tech events will land in your inbox each Monday morning."
      : result === "already"
        ? "This email is already subscribed - nothing to do. Watch your inbox Monday morning."
        : result === "invalid"
          ? "This confirmation link is invalid or expired. Resubscribe from the subscribe page to get a fresh link."
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
