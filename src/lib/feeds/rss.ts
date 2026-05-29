import type { EventWithGroup } from "../queries";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function eventsToRss(events: EventWithGroup[], baseUrl: string): string {
  const now = new Date().toUTCString();
  const items = events
    .map((e) => {
      const link = e.link ?? `${baseUrl}/event/${e.id}`;
      const start = new Date(e.startsAt);
      const pubDate = start.toUTCString();
      const locationParts = [e.venueName, e.address, e.city, e.state].filter(Boolean);
      const desc = [
        e.description ?? "",
        locationParts.length ? `Where: ${locationParts.join(", ")}` : "",
        e.tags && e.tags.length ? `Tags: ${e.tags.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Utah Tech Events</title>
    <link>${baseUrl}</link>
    <description>In-person Utah tech events. Curated.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
