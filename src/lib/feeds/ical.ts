import type { EventWithGroup } from "../queries";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toUtcIcal(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcal(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function eventsToIcal(events: EventWithGroup[], host: string): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Utah Tech Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Utah Tech Calendar",
    "X-WR-CALDESC:In-person Utah tech events",
    "X-WR-TIMEZONE:America/Denver",
  ];

  for (const e of events) {
    const start = new Date(e.startsAt);
    const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
    const summary = e.group ? `${e.group.name}: ${e.title}` : e.title;
    const locationParts = [e.venueName, e.address, e.city, e.state, e.postalCode].filter(Boolean);
    const location = locationParts.join(", ");
    const descriptionParts = [
      e.description ?? "",
      e.group ? `Group: ${e.group.name}` : "",
      e.tags && e.tags.length ? `Tags: ${e.tags.join(", ")}` : "",
      e.link ? `Link: ${e.link}` : "",
    ].filter(Boolean);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${host}`,
      `DTSTAMP:${toUtcIcal(now)}`,
      `DTSTART:${toUtcIcal(start)}`,
      `DTEND:${toUtcIcal(end)}`,
      `SUMMARY:${escapeIcal(summary)}`,
      `DESCRIPTION:${escapeIcal(descriptionParts.join("\n\n"))}`,
    );
    if (location) lines.push(`LOCATION:${escapeIcal(location)}`);
    if (e.link) lines.push(`URL:${e.link}`);
    lines.push("STATUS:CONFIRMED", "SEQUENCE:0", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
