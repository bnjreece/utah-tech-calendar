/* Sources have no name column, so admin lists show the raw URL — hard
   to scan. Derive a readable label from the URL per adapter. Display
   only; the URL stays the source of truth. */
export function deriveSourceName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const segs = u.pathname
      .split("/")
      .filter(Boolean)
      .map((s) => decodeURIComponent(s));

    const titleize = (s: string) =>
      s
        .replace(/--/g, " ") // eventbrite uses -- between words
        .replace(/[-_]+/g, " ")
        .trim()
        .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
        .replace(/\bUt\b/g, "UT")
        .replace(/\bSlc\b/g, "SLC");

    if (host.includes("meetup.com")) {
      return segs[0] ? titleize(segs[0]) : "Meetup group";
    }
    if (host.includes("eventbrite.")) {
      if (segs[0] === "d" && segs[2]) return `${titleize(segs[1])} · ${titleize(segs[2])}`;
      if (segs[0] === "o" && segs[1]) return titleize(segs[1]);
      return titleize(segs[segs.length - 1] ?? host);
    }
    if (host === "lu.ma" || host.includes("luma.com")) {
      return segs[0] ? titleize(segs[0]) : "Luma calendar";
    }
    if (host.endsWith("substack.com")) {
      return titleize(host.replace(".substack.com", ""));
    }
    if (host.includes("siliconslopes")) return "Silicon Slopes";

    const last = segs[segs.length - 1];
    return last ? titleize(last) : titleize(host.split(".")[0]);
  } catch {
    return url;
  }
}
