import type { Metadata } from "next";

/* Embed routes ship with no global chrome - no header nav, no footer.
   This layout replaces the root layout's <header> + <footer> wrappers
   with a bare passthrough so the iframe content is exactly what the
   embedder asked for. Next.js layouts compose, but a bare div here
   means the parent root layout's body still applies (font tokens,
   theme variant) while the structural chrome inside the body is
   skipped via CSS - see below. */

export const metadata: Metadata = {
  /* No-index so the embed URL doesn't compete with the main route
     in search rankings. Embedders linking to the embed URL get the
     iframe behavior, not a Google-indexed alternate of the schedule. */
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* The root layout already wraps everything in a body with the
     sticky header and footer. We CAN'T remove those from inside a
     nested layout, but we CAN add a marker class that the root
     layout uses to suppress them when embed context is active.
     Simpler: just add a body-level CSS rule via a data attribute. */
  return (
    <div data-embed-context="true" className="contents">
      {children}
    </div>
  );
}
