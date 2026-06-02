import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["scraper-kit"],

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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
      {
        /* Embed route is the explicit framable surface. CSP
           frame-ancestors * supersedes the SAMEORIGIN above; we also
           clear X-Frame-Options because there's no "anyone except
           admin" XFO value (XFO predates CSP and only supports DENY
           / SAMEORIGIN / ALLOW-FROM single origin). */
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "" },
        ],
      },
      {
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "" },
        ],
      },
    ];
  },
};

export default nextConfig;
