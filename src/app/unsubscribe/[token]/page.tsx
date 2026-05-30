import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, emailSubscriptions } from "@/lib/db";
import { verifySubscriptionToken } from "@/lib/subscription-token";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Unsubscribe · Utah Tech Events",
  robots: { index: false, follow: false },
};

async function consume(tokenStr: string): Promise<"ok" | "invalid" | "error"> {
  const payload = verifySubscriptionToken(tokenStr);
  if (!payload || payload.kind !== "unsubscribe") return "invalid";
  try {
    await db
      .update(emailSubscriptions)
      .set({ unsubscribedAt: new Date(), verifiedAt: null })
      .where(eq(emailSubscriptions.id, payload.subscriptionId));
    return "ok";
  } catch (err) {
    console.warn("[unsubscribe] db error", err);
    return "error";
  }
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await consume(token);

  const heading =
    result === "ok" ? "Unsubscribed." :
    result === "invalid" ? "Link not recognized." :
    "Something broke.";
  const body =
    result === "ok"
      ? "You're off the digest list. No more Monday morning emails. The full schedule still lives on the site if you ever want to check it."
      : result === "invalid"
        ? "This unsubscribe link doesn't look right. If you're getting unwanted emails, reply to one of them and I'll remove you by hand."
        : "We hit a database error processing this. Try again, or email b@bnjmn.org.";

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
      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-ink-soft hover:text-ink underline underline-offset-4"
        >
          ← Back to the schedule
        </Link>
      </div>
    </div>
  );
}
