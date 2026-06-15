import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ReflectionShimmerLogo } from "@/components/logos";
import { ForgeCredit } from "@/components/forge-credit";
import { SiteNav } from "@/components/site-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getFeaturedVerticals } from "@/lib/tag-taxonomy";
import "./globals.css";

/* Snapshot at module load (server-only) so we don't re-resolve on
   every render. The list is hand-curated, not data-driven. */
const FOOTER_VERTICALS = getFeaturedVerticals().map((v) => ({
  tag: v.tag,
  display: v.display,
}));

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Utah tech calendar",
    "Utah tech events",
    "Utah developer meetups",
    "Salt Lake City tech events",
    "Provo tech meetups",
    "Silicon Slopes events",
    "Utah JavaScript meetup",
    "Utah AI meetup",
    "Utah fintech events",
    "Utah healthtech events",
    "Utah edtech events",
    "Utah biotech events",
    "Utah cybersecurity events",
    "Utah startup events",
    "Lehi tech meetups",
    "Ogden tech events",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [{ url: "/api/rss", title: `${SITE_NAME} RSS` }],
      "text/calendar": [{ url: "/api/ical", title: `${SITE_NAME} iCal` }],
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full theme-editorial">
      <head>
        {/* Pre-paint dark-mode bootstrapper, served as a static asset
            so we can attach beforeInteractive without inlining JS in
            the document body. Reads the same localStorage key as
            components/theme-toggle.tsx and applies .dark to <html>
            before React hydrates. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline theme bootstrap must run before first paint to prevent FOUC; defer/async would reintroduce the flash */}
        <script src="/theme-init.js" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout is the correct place for the font link; pages/_document.js does not exist here */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..700&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
        />
      </head>
      <body className="isolate min-h-dvh flex flex-col bg-background text-foreground antialiased">
        <ClerkProvider>
          <TooltipProvider>
          <header className="site-chrome sticky top-0 z-30 bg-paper/85 backdrop-blur-xl border-b border-ink/10">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sm:gap-6">
              <Link
                href="/"
                aria-label="Homepage"
                className="group flex items-center gap-2.5 hover:text-sunset-deep transition-colors min-w-0"
              >
                <ReflectionShimmerLogo
                  className="text-ink group-hover:text-sunset-deep transition-colors shrink-0"
                  style={{ width: "32px", height: "32px", transform: "translateY(3px)" }}
                />
                <span className="font-display text-2xl tracking-tight leading-none truncate">
                  <span className="hidden sm:inline">utah tech calendar</span>
                  <span className="sm:hidden">UTC</span>
                </span>
              </Link>
              <SiteNav />
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="site-chrome mt-12 border-t-2 border-ink">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
            {/* Vertical index - internal linking to the curated tag
                landing pages so Google can crawl them from every
                surface, and visitors can drill into their corner of
                the scene without learning the URL structure. */}
            <div className="pb-8 border-b border-ink/15">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-3">
                Browse by vertical
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em]">
                {FOOTER_VERTICALS.map((v) => (
                  <Link
                    key={v.tag}
                    href={`/tag/${v.tag}`}
                    className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
                  >
                    {v.display}
                  </Link>
                ))}
              </div>
            </div>
            <div className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <ReflectionShimmerLogo
                  className="text-ink"
                  style={{ width: "16px", height: "16px", transform: "translateY(2px)" }}
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                  compiled in cottonwood heights, utah · updated nightly
                </p>
              </div>
              <div className="flex items-baseline gap-5 font-mono text-[11px] uppercase tracking-[0.18em]">
                <Link href="/discover" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  discover
                </Link>
                <Link href="/archive" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  archive
                </Link>
                <Link href="/about" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  about
                </Link>
                <Link href="/api/ical" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  ical
                </Link>
                <Link href="/api/rss" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  rss
                </Link>
                <Link href="/subscribe#embed" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  embed
                </Link>
                <Link href="/submit" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                  submit
                </Link>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-ink/15 flex justify-center">
              <ForgeCredit />
            </div>
          </div>
        </footer>
          </TooltipProvider>
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
