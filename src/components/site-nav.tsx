"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { MobileNav } from "./mobile-nav";

/* Allowlist parallel to lib/admin-auth.ts. Server-side requireAdmin
   is the actual gate; this surface only decides whether to surface
   the admin LINK. Anyone non-admin who finds /admin still hits the
   server-side redirect. */
const ADMIN_EMAILS = new Set<string>(["b@bnjmn.org"]);

/* Client-side site nav. Uses Clerk's useUser hook rather than a
   server-side auth() check so we don't have to expand the proxy.ts
   matcher to every public route - that would pay ~260KB of Clerk JS
   + a session handshake on every anonymous visit just to render an
   admin link for one person. Trade-off: the admin link hydrates in
   after first paint, instead of being SSR'd. Acceptable: only the
   admin sees the link, and they'll never notice the ~50ms delay. */
export function SiteNav() {
  const { user, isLoaded } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const showAdmin = isLoaded && !!email && ADMIN_EMAILS.has(email);

  const links = [
    { href: "/", label: "events", hiddenOnMobile: true },
    { href: "/discover", label: "discover" },
    { href: "/subscribe", label: "subscribe" },
    { href: "/submit", label: "submit" },
    ...(showAdmin ? [{ href: "/admin", label: "admin" }] : []),
  ];

  return (
    <>
      {/* Desktop nav - inline pills */}
      <nav className="hidden sm:flex items-baseline gap-4 sm:gap-5 font-mono text-[11px] uppercase tracking-[0.18em] shrink-0">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Mobile - hamburger that opens a sheet with all links */}
      <MobileNav
        links={links.map((l) => ({ href: l.href, label: l.label }))}
      />
    </>
  );
}
