import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Utah Tech Events",
  description: "Curated calendar of in-person Utah tech events. Meetups, conferences, founder mixers, AI, design, hardware.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Utah Tech Events
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Events</Link>
              <Link href="/submit" className="hover:text-foreground">Submit</Link>
              <Link href="/api/ical" className="hover:text-foreground">iCal</Link>
              <Link href="/api/rss" className="hover:text-foreground">RSS</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t mt-12">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground flex items-center justify-between">
            <span>Utah Tech Events</span>
            <span>In-person events default. Online filtered out.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
