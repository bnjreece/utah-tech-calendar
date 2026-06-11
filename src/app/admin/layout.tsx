import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/recent", label: "Recent" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/hidden", label: "Hidden" },
  { href: "/admin/notifications", label: "Notifications" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        <header className="border-b-2 border-ink pb-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Admin · super editor
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight italic">
                The Editor&apos;s Desk
              </h1>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft break-all">
              signed in as {user.email}
            </div>
          </div>
          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em]">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="mt-10">{children}</div>
      </div>
  );
}
