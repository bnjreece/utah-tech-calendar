import type { NextConfig } from "next";
import { RETIRED_TAG_SEARCH, TAG_ALIASES } from "./src/lib/auto-tag";

const nextConfig: NextConfig = {
  transpilePackages: ["scraper-kit"],

  /* Old tag spellings (lib/auto-tag.ts TAG_ALIASES) 308 to the canonical
     tag page; a retired tag goes to a homepage search. ?tags= in URLs and
     feeds is aliased in lib/filters.ts instead. */
  async redirects() {
    return Object.entries(TAG_ALIASES).map(([alias, canonical]) => ({
      source: `/tag/${alias}`,
      destination: canonical
        ? `/tag/${canonical}`
        : RETIRED_TAG_SEARCH[alias]
          ? `/?q=${encodeURIComponent(RETIRED_TAG_SEARCH[alias])}`
          : "/",
      permanent: true,
    }));
  },

  /* Clickjacking + iframe policy.
     - Default: DENY framing site-wide. Without this an attacker page
       can iframe /admin, /sign-in, or the magic-link /moderate flow
       and clickjack the user into an unintended click.
     - Exception: /embed is the product surface for being framed by
       any Utah tech site. frame-ancestors * lets ALL origins embed it.
       Same path also clears X-Frame-Options (which can't express
       "anyone but admin"). */
  async headers() {
    /* Rule order matters: when multiple rules match, the LAST one's
       headers override earlier ones for duplicate keys. Catch-all
       site-wide DENY comes first; embed-specific exception is last
       so it wins on /embed routes. */
    /* Baseline hardening headers applied site-wide. These are safe to
       send everywhere and don't affect scripts/styles, so no per-page
       tuning is needed. A strict script-src CSP is intentionally NOT
       set here: Next.js inline hydration scripts + Clerk need nonce-
       based CSP, which requires testing every route - tracked as a
       follow-up. The CSP we do send hardens framing, plugins, and the
       <base> tag. */
    const baseline = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
    ];

    /* Embed route is the explicit framable surface. Override only the
       framing directives (CSP frame-ancestors + clear X-Frame-Options);
       keep object-src/base-uri and the other baseline headers, which
       Next preserves because they aren't re-declared in this rule. */
    const embed = [
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors *; object-src 'none'; base-uri 'self'",
      },
      { key: "X-Frame-Options", value: "" },
    ];

    return [
      { source: "/:path*", headers: baseline },
      { source: "/embed/:path*", headers: embed },
      { source: "/embed", headers: embed },
    ];
  },
};

export default nextConfig;
