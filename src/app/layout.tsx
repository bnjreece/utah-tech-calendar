import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utah Tech Events",
  description:
    "Curated, in-person Utah tech events. Meetups, conferences, founder mixers, AI, hardware, design. Online events filtered by default.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
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
        <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur-xl border-b border-ink/5">
          <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center justify-between gap-6">
            <Link href="/" aria-label="Homepage" className="flex items-center gap-2.5">
              <span aria-hidden className="block size-4 rounded-full strata-divider" />
              <span className="font-semibold tracking-tight text-base">
                Utah Tech Events
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 text-ink-soft hover:text-ink transition-colors"
              >
                Events
              </Link>
              <Link
                href="/api/ical"
                className="px-3 py-1.5 text-ink-soft hover:text-ink transition-colors"
              >
                Subscribe
              </Link>
              <Link
                href="/submit"
                className="ml-2 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 transition-colors"
              >
                Submit
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Script src="https://ui.sh/ui-picker.js" strategy="afterInteractive" />
        <footer className="mt-16 border-t border-ink/5">
          <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="block size-3 rounded-full strata-divider" />
                <span className="font-semibold tracking-tight">Utah Tech Events</span>
              </div>
              <p className="mt-2 text-sm text-ink-soft text-pretty max-w-md">
                Real, in-person Utah tech events. Online events filtered out by default — toggle them on when you want them.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/api/ical" className="text-ink-soft hover:text-ink transition-colors">
                iCal
              </Link>
              <Link href="/api/rss" className="text-ink-soft hover:text-ink transition-colors">
                RSS
              </Link>
              <Link href="/submit" className="text-ink-soft hover:text-ink transition-colors">
                Submit
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
