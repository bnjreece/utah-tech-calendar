import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { ReflectionShimmerLogo } from "@/components/logos";
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
    <ClerkProvider>
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
                style={{ width: "20px", height: "20px", transform: "translateY(2px)" }}
              />
              <span className="font-display text-base tracking-tight leading-none truncate">
                utah tech <span className="italic">events</span>
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
      </body>
    </html>
    </ClerkProvider>
  );
}
