import { SubscribePopover } from "@/components/subscribe-popover";

export const metadata = {
  title: "Subscribe - Utah Tech Events",
};

interface Preset {
  id: string;
  title: string;
  description: string;
  query: string;
  meta: string;
}

const PRESETS: Preset[] = [
  {
    id: "all",
    title: "The Full Schedule",
    description:
      "Every in-person Utah tech event we surface. Default subscription. Online events filtered out by default; toggle them on by adding ?online=show.",
    query: "",
    meta: "all sources · all regions",
  },
  {
    id: "salt-lake",
    title: "Salt Lake County",
    description:
      "Events along the Wasatch Front in Salt Lake City, Sandy, Lehi (Salt Lake side), Draper, West Valley, and surrounding cities.",
    query: "regions=Salt+Lake+County",
    meta: "region · Salt Lake County",
  },
  {
    id: "utah-county",
    title: "Utah County · Silicon Slopes",
    description:
      "Provo, Orem, Lehi, American Fork, Saratoga Springs. The startup belt south of the point of the mountain.",
    query: "regions=Utah+County",
    meta: "region · Utah County",
  },
  {
    id: "ai",
    title: "AI & Machine Learning",
    description:
      "Anything tagged AI or ML across all sources. Founders, engineers, applied research, weekend hackathons.",
    query: "tags=ai",
    meta: "tag · ai",
  },
  {
    id: "founders",
    title: "Founders & Startup",
    description:
      "Pitch nights, founder mixers, accelerator demo days, Silicon Slopes events.",
    query: "tags=startup,founders",
    meta: "tags · startup, founders",
  },
  {
    id: "meetup",
    title: "Just Meetup",
    description:
      "Only events from Meetup groups. Highest-signal source — community-run, real venues, recurring.",
    query: "sources=meetup",
    meta: "source · meetup",
  },
];

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Subscribe
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        Get the schedule in your calendar.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft leading-relaxed">
        Subscribe once and the events flow into your calendar. Pick a curated
        view below, or apply any filter on the schedule page and use{" "}
        <em>Subscribe to this view</em> to build a custom URL. We update nightly.
      </p>

      <ul role="list" className="mt-12 flex flex-col">
        {PRESETS.map((preset) => (
          <li
            key={preset.id}
            className="border-t border-ink/15 first:border-t-0 py-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-3 items-start"
          >
            <div>
              <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-ink">
                {preset.title}
              </h2>
              <p className="mt-2 max-w-[58ch] text-pretty text-ink-soft leading-relaxed">
                {preset.description}
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                {preset.meta}
              </p>
            </div>
            <div className="sm:pt-2">
              <SubscribePopover
                feedQuery={preset.query}
                triggerLabel="Subscribe"
                variant="card"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-14 pt-6 border-t-2 border-ink font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Pro tip — every filter combination on the schedule page is a valid
        subscription URL. Stack regions, tags, sources, dates, anything.
      </p>
    </div>
  );
}
