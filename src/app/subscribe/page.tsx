import { FeedBuilder } from "@/components/feed-builder";
import { getCityCounts, getTagCounts, getSourceCounts } from "@/lib/queries";

export const metadata = {
  title: "Subscribe - Utah Tech Calendar",
};

export default async function SubscribePage() {
  const [cityRows, tagRows, sourceRows] = await Promise.all([
    getCityCounts(),
    getTagCounts(),
    getSourceCounts(),
  ]);
  const cities = cityRows.map((r) => ({ value: r.city, count: r.count }));
  const tags = tagRows.map((r) => ({ value: r.tag, count: r.count }));
  const sources = sourceRows.map((r) => ({ value: r.source, count: r.count }));

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Subscribe
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        Build your view, pick your channel.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft leading-relaxed">
        Stack any combination of regions, cities, tags, sources, and types
        below. Then choose how you want it - piped into your calendar, or as
        a weekly Monday morning email. Same filters, your call.
      </p>

      <div className="mt-12">
        <FeedBuilder cities={cities} tags={tags} sources={sources} />
      </div>

      <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Tip — every filter combination on the schedule page is also a valid
        subscription URL. Filter the schedule the way you like, then look for
        the Subscribe button in the filter bar.
      </p>
    </div>
  );
}
