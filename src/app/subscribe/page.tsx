import { EmailSignup } from "@/components/email-signup";
import { FeedBuilder } from "@/components/feed-builder";
import { getCityCounts, getTagCounts, getSourceCounts } from "@/lib/queries";

export const metadata = {
  title: "Subscribe - Utah Tech Events",
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
        Get the schedule in your calendar.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft leading-relaxed">
        Build the slice you want below and the events flow into Apple Calendar,
        Google Calendar, or any reader that speaks iCal or RSS. Or get the
        Monday morning email instead. The site updates daily.
      </p>

      <section className="mt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Build your view
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl italic tracking-tight">
          Filter, then subscribe.
        </h2>
        <p className="mt-3 max-w-[58ch] text-pretty text-ink-soft leading-relaxed">
          Stack any combination of regions, cities, tags, sources, and types.
          The Subscribe button hands you an Apple Calendar / Google Calendar
          link with those exact filters baked in.
        </p>
        <div className="mt-8">
          <FeedBuilder cities={cities} tags={tags} sources={sources} />
        </div>
      </section>

      <section className="mt-16 border-y-2 border-ink py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Weekly digest
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl italic tracking-tight">
          Or get one email a week.
        </h2>
        <p className="mt-3 max-w-[58ch] text-pretty text-ink-soft leading-relaxed">
          A Monday morning rundown of the next seven days of in-person Utah
          tech events. No filler, no tracking pixels, no sponsored slots.
        </p>
        <div className="mt-6 max-w-md">
          <EmailSignup />
        </div>
      </section>

      <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Tip — every filter combination on the schedule page is also a valid
        subscription URL. Filter the schedule the way you like, then look for
        the Subscribe button in the filter bar.
      </p>
    </div>
  );
}
