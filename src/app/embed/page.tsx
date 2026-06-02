import type { Metadata } from "next";
import Link from "next/link";
import { parseFilters } from "@/lib/filters";
import { queryEvents } from "@/lib/queries";
import { EditorialLinearCard } from "@/components/variant-cards";
import { EmbedLinkTarget } from "@/components/embed-link-target";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

/* Cache the embed render for 5 minutes - a popular embedder hitting
   us 10k times/day would otherwise pound Neon on every iframe view.
   With revalidate=300 the same filter slice serves from Vercel's
   edge for 5 min. New events still surface within 5 min of the
   next scrape; the freshness budget is fine for an embedded widget. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${SITE_NAME} embed`,
  robots: { index: false, follow: false },
};

interface EmbedSearchParams {
  [key: string]: string | string[] | undefined;
}

/* Stripped-layout calendar render for <iframe> embedding on other
   Utah tech sites. Honors the same filter URL params as the homepage
   (tags, cities, regions, types, etc) plus three embed-specific knobs:

   - theme: "light" | "dark" | "auto" (default auto, falls back to
     system preference). Set explicitly to override the embedder's
     system pref - useful when the host site is forced light/dark.
   - limit: 1-50, default 15. Embed grids should stay short to fit
     into a sidebar or section without making the host site scroll.
   - attribution: "true" (default) | "false". When false the bottom
     "via Utah Tech Calendar" row is hidden. We're not enforcing
     attribution as a license condition - just trusting embedders
     to leave it in by default. */
export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<EmbedSearchParams>;
}) {
  const params = await searchParams;
  /* Strip embed-only knobs so they don't leak into parseFilters and
     accidentally match a future filter field with the same name. */
  const { theme: rawTheme, limit: rawLimit, attribution: rawAttribution, ...filterParams } = params;
  const filters = parseFilters(filterParams);
  const limitRaw = typeof rawLimit === "string" ? Number(rawLimit) : 15;
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 15;
  const theme = typeof rawTheme === "string" ? rawTheme : "auto";
  const attribution = rawAttribution !== "false";

  const evts = await queryEvents(filters, limit);

  /* Build a deep link back to the full filtered view so an embed
     visitor can click through to the source-of-truth schedule. Uses
     the filter-only params we already separated above. */
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filterParams)) {
    if (typeof v === "string") sp.set(k, v);
  }
  const fullViewUrl = `${SITE_URL}/${sp.toString() ? `?${sp.toString()}` : ""}`;

  /* Embed surface is intentionally not the public theme-editorial
     wrapper - hosting sites have their own visual identity and the
     embed should sit lightly inside it. */
  const wrapperClass =
    theme === "dark"
      ? "dark theme-editorial"
      : "theme-editorial";

  return (
    <div className={`${wrapperClass} min-h-dvh bg-paper text-ink`}>
      {/* Auto theme: static external script flips <html> to .dark when
          the embedder's system pref is dark. Lives in /public so it
          loads with strategy=beforeInteractive and matches first
          paint inside the iframe. */}
      {theme === "auto" && <script src="/embed-theme-auto.js" />}
      {/* Promote all <a> links inside the embed to target=_top so
          clicks open in the embedder's parent window, not inside the
          iframe. Otherwise the event detail page would render the
          full site chrome squeezed into 640px. */}
      <EmbedLinkTarget />
      <div className="px-4 sm:px-6 py-6">
        {evts.length === 0 ? (
          <p className="font-display italic text-lg text-ink-soft text-center py-10">
            No upcoming events on this filter.
          </p>
        ) : (
          <ul role="list" className="flex flex-col">
            {evts.map((e) => (
              <li key={e.id}>
                <EditorialLinearCard event={e} />
              </li>
            ))}
          </ul>
        )}
        {attribution && (
          <div className="mt-6 pt-4 border-t border-ink/10 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            <a
              href={fullViewUrl}
              target="_blank"
              rel="noopener"
              className="hover:text-ink transition-colors"
            >
              {evts.length === limit ? `+ more · ` : ""}via Utah Tech Calendar
            </a>
            <Link
              href={fullViewUrl}
              target="_blank"
              rel="noopener"
              className="hover:text-ink transition-colors"
            >
              open full schedule →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
