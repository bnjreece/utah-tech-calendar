/* Minimal HTML entity escaping for interpolating untrusted text into
   HTML email bodies. Scraped/submitted fields (event titles, venue,
   submitter names) flow into moderator/digest emails; without escaping
   a crafted submission could inject markup into the moderator's inbox.
   Shared so every email builder uses the same implementation. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
