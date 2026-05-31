import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ReflectionShimmerLogo } from "@/components/logos";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
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
        <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur-xl border-b border-ink/10">
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
                <span className="hidden sm:inline">utah tech <span className="italic">calendar</span></span>
                <span className="sm:hidden">UTC</span>
              </span>
            </Link>
            <nav className="flex items-baseline gap-4 sm:gap-5 font-mono text-[11px] uppercase tracking-[0.18em] shrink-0">
              <Link
                href="/"
                className="hidden sm:inline text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
              >
                events
              </Link>
              <Link
                href="/subscribe"
                className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors"
              >
                subscribe
              </Link>
              <Link
                href="/submit"
                className="text-ink hover:text-sunset-deep hover:underline decoration-1 underline-offset-4 transition-colors"
              >
                submit
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-12 border-t-2 border-ink">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              <Link href="/about" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                about
              </Link>
              <Link href="/api/ical" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                ical
              </Link>
              <Link href="/api/rss" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                rss
              </Link>
              <Link href="/submit" className="text-ink-soft hover:text-ink hover:underline decoration-1 underline-offset-4 transition-colors">
                submit
              </Link>
            </div>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
