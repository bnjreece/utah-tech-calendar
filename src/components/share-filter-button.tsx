"use client";

import { useState } from "react";

interface ShareFilterButtonProps {
  /* Caller passes the path + querystring the user should land on.
     Component prepends window.location.origin at click time so SSR
     doesn't see a host. Falls back to window.location.href when no
     explicit href is supplied. */
  href?: string;
  /* Label override for the button. Default "Share". */
  label?: string;
  className?: string;
}

export function ShareFilterButton({ href, label = "Share", className }: ShareFilterButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const url = href
      ? `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`
      : window.location.href;
    /* Prefer the native share sheet on devices that have one (iOS,
       Android, desktop PWAs). Falls back to clipboard copy elsewhere -
       desktop browsers without webshare. */
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: "Utah Tech Calendar" });
        return;
      } catch {
        /* User cancelled the share sheet - fall through to copy so
           they still get something. */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      /* Clipboard API blocked (insecure context, denied perms). Fall
         through to the deprecated execCommand path. */
    }
    /* Last resort: select a synthetic textarea and exec copy. Returns
       false on failure - we honor that and prompt the user to copy
       manually rather than silently lying about "Copied". */
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch {
      succeeded = false;
    } finally {
      document.body.removeChild(textarea);
    }
    if (succeeded) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      /* Visible failure path - prompt() is ugly but truthful, and
         the user can ⌘C from the prompt's selected text on most
         platforms. Beats "Copied" lying to them. */
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "ml-1 text-xs text-foreground/55 hover:text-foreground transition-colors"
      }
    >
      {copied ? "Copied" : label}
    </button>
  );
}
