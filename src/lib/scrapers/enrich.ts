import * as cheerio from "cheerio";

/* Per-event description enrichment shared by the list-only adapters
   (Luma, Silicon Slopes). Their calendar/list endpoints return just a
   title + time + cover - the body lives on each event's own page - so we
   fetch each event once more to recover a real description. Without it the
   self-healing classifier judges these events on the title alone (which is
   how a real "ShillFest at mtndao" or a kids coding camp got mislabeled).
   Everything here fails SOFT: a failed enrichment leaves the event exactly
   as the list scrape produced it. */

/* Bounded-concurrency map - enrich many events without firing N fetches at
   once (rate-limit friendly + memory bounded). A worker pool pulls from a
   shared cursor; single-threaded JS makes `cursor++` safe. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) break;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/* Pull a plain-text description from a page's og:description / meta
   description. Circle (Silicon Slopes) renders the event-body summary into
   these tags server-side even though the full body is client-rendered. */
export function extractMetaDescription(html: string): string | undefined {
  const $ = cheerio.load(html);
  const pick = (sel: string): string | undefined => {
    const c = $(sel).attr("content")?.trim();
    return c && c.length > 0 ? c : undefined;
  };
  return (
    pick('meta[property="og:description"]') ??
    pick('meta[name="description"]') ??
    pick('meta[name="twitter:description"]')
  );
}

/* Flatten a Luma rich-text (tiptap / ProseMirror) document to plain text by
   concatenating its text nodes. Luma stores an event body as
   `description_mirror`, a nested {type, content, text} tree - not a string. */
export function flattenTiptap(doc: unknown): string {
  const parts: string[] = [];
  const visit = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (o.type === "text" && typeof o.text === "string") parts.push(o.text);
    if (Array.isArray(o.content)) for (const c of o.content) visit(c);
  };
  visit(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/* Cap a recovered description so a runaway body can't bloat a row. The
   classifier only reads the first ~800 chars and cards show far less. */
export function clampDescription(text: string | undefined, max = 1500): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
