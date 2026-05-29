import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="isolate min-h-dvh flex flex-col bg-background text-foreground antialiased">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-foreground/5">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
            <Link href="/" aria-label="Homepage" className="flex items-baseline gap-2">
              <span className="font-display text-2xl leading-none">Utah Tech</span>
              <span className="font-display text-2xl italic leading-none text-brand">events</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 text-foreground/70 hover:text-foreground transition-colors"
              >
                Events
              </Link>
              <Link
                href="/api/ical"
                className="px-3 py-1.5 text-foreground/70 hover:text-foreground transition-colors"
              >
                Subscribe
              </Link>
              <Link
                href="/submit"
                className="ml-2 inline-flex items-center rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-foreground/85 transition-colors"
              >
                Submit
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-foreground/5 mt-16">
          <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-foreground/55">
            <div>
              <span className="font-display text-lg leading-none">Utah Tech</span>{" "}
              <span className="font-display italic text-lg leading-none">events</span>
            </div>
            <p className="text-pretty max-w-md">
              In-person Utah tech events, curated. Online events are filtered out by default — toggle them on if you want.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
