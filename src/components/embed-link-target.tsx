"use client";

import { useEffect } from "react";

/* Runs inside the embed iframe. Promotes all internal links to
   target the parent window so clicking an event card from inside an
   iframe opens the event page in the embedder's tab/parent context,
   not as a tiny full-chrome render inside the iframe.

   Externally-targeted links (target=_blank set by the page already)
   are left alone. Anchors with target=_top get set too as a no-op
   safety. Runs once on mount; the embed's content is server-rendered
   so no re-runs needed after navigation. */
export function EmbedLinkTarget() {
  useEffect(() => {
    const root = document.querySelector("[data-embed-context='true']");
    if (!root) return;
    const links = root.querySelectorAll<HTMLAnchorElement>("a[href]");
    for (const a of links) {
      if (!a.target || a.target === "_self") {
        a.target = "_top";
      }
    }
  }, []);
  return null;
}
