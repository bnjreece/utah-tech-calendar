import { ReflectionShimmerLogo } from "@/components/logos";

export const metadata = {
  title: "Wordmark studies - Utah Tech Calendar",
};

interface VariantProps {
  id: string;
  name: string;
  category: "ui.sh" | "my take";
  note: string;
  wordmark: React.ReactNode;
}

const VARIANTS: VariantProps[] = [
  /* ─── ui.sh-disciplined (6) ─────────────────────────────────────── */
  {
    id: "01-mixed-italic-current",
    name: "Mixed italic",
    category: "ui.sh",
    note:
      "Current header. Roman 'utah tech', italic 'events'. Restrained, two-tone within one wordmark. The italic does the work of pointing at the TLD.",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none">
        utah tech <span className="italic">events</span>
      </span>
    ),
  },
  {
    id: "02-all-italic",
    name: "All italic",
    category: "ui.sh",
    note:
      "Pure italic Fraunces, tight tracking. Most editorial-periodical of the set. Apartamento-adjacent.",
    wordmark: (
      <span className="font-display text-base tracking-tight italic leading-none">
        utah tech calendar
      </span>
    ),
  },
  {
    id: "03-period-close",
    name: "Period close",
    category: "ui.sh",
    note:
      "Mixed italic + explicit period. The period reads as a declarative editorial close, like a masthead. Apartamento move.",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none">
        utah tech <span className="italic">events</span>.
      </span>
    ),
  },
  {
    id: "04-title-italic",
    name: "Title italic",
    category: "ui.sh",
    note:
      "Title case italic — more formal, more typographically present. The capitals slow you down; reads as a proper publication name.",
    wordmark: (
      <span className="font-display text-base tracking-tight italic leading-none">
        Utah Tech Calendar
      </span>
    ),
  },
  {
    id: "05-small-caps-wide",
    name: "Small caps wide",
    category: "ui.sh",
    note:
      "Uppercase Fraunces with wide tracking (0.18em). Has the authority of a section masthead. Tracking gives the caps room to breathe.",
    wordmark: (
      <span className="font-display text-sm tracking-[0.18em] uppercase leading-none">
        utah tech calendar
      </span>
    ),
  },
  {
    id: "06-numero-prefix",
    name: "Numero prefix",
    category: "ui.sh",
    note:
      "Small mono № prefix + roman wordmark. The mono character borrowed from periodical mastheads (the № 1 in our schedule heading).",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none inline-flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] tracking-normal uppercase">№</span>
        <span>utah tech <span className="italic">events</span></span>
      </span>
    ),
  },

  /* ─── My take (6) ──────────────────────────────────────────────── */
  {
    id: "07-slashes-italic",
    name: "Slashes",
    category: "my take",
    note:
      "Italic with slash separators. Pulls the wordmark closer to URL territory — utah/tech/events. Feels like a path you're traveling down.",
    wordmark: (
      <span className="font-display text-base tracking-tight italic leading-none">
        utah / tech / events
      </span>
    ),
  },
  {
    id: "08-dots",
    name: "Bullet separators",
    category: "my take",
    note:
      "Middle-dots between words, italic events at the end. Telegraph-y rhythm. Each word gets equal weight before the italic punctuates the end.",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none">
        utah · tech · <span className="italic">events</span>
      </span>
    ),
  },
  {
    id: "09-ampersand",
    name: "Ampersand",
    category: "my take",
    note:
      "Reads as 'utah-tech [domain] AND events [product]'. Groups the brand differently — two parts of one thing. The italic Fraunces ampersand is gorgeous.",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none">
        utah tech <span className="italic">&amp;</span> events
      </span>
    ),
  },
  {
    id: "10-all-caps-tight",
    name: "All caps tight",
    category: "my take",
    note:
      "Full uppercase Fraunces semibold with very tight tracking. Authoritative, almost monumental. Trades editorial softness for institutional presence.",
    wordmark: (
      <span className="font-display text-sm font-semibold tracking-[0.02em] uppercase leading-none">
        Utah Tech Calendar
      </span>
    ),
  },
  {
    id: "11-plus",
    name: "Plus separators",
    category: "my take",
    note:
      "Plus signs between words. Reads as additive — utah + tech + events together as a sum. A little 80s-tech, a little optimistic.",
    wordmark: (
      <span className="font-display text-base tracking-tight leading-none">
        utah + tech + <span className="italic">events</span>
      </span>
    ),
  },
  {
    id: "12-domain-mono",
    name: "Domain hyphen mono",
    category: "my take",
    note:
      "Hyphenated, all-mono — looks like the URL the project ships as. Anti-elegant; trades the editorial register for tool-belt utility. The most committed dev brand.",
    wordmark: (
      <span className="font-mono text-sm tracking-tight leading-none lowercase">
        utah-tech-events
      </span>
    ),
  },
];

export default function WordmarkPage() {
  const uiSh = VARIANTS.filter((v) => v.category === "ui.sh");
  const myTake = VARIANTS.filter((v) => v.category === "my take");

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Wordmark studies
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        Twelve type treatments.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft leading-relaxed">
        Six by ui.sh design discipline, six my own creative direction. Each shown
        in the actual sticky header context beside the Shimmer logo, in ink and
        the burgundy hover state. Pick one and I&apos;ll wire it into the live
        header, or tell me which two to combine.
      </p>

      <section className="mt-14">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft pb-3 border-b-2 border-ink">
          ui.sh — restrained, type-led
        </h2>
        <ul role="list" className="flex flex-col">
          {uiSh.map((v) => (
            <li key={v.id}>
              <WordmarkRow variant={v} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft pb-3 border-b-2 border-ink">
          my take
        </h2>
        <ul role="list" className="flex flex-col">
          {myTake.map((v) => (
            <li key={v.id}>
              <WordmarkRow variant={v} />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-16 pt-6 border-t border-ink/15 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        Tell me your pick. I&apos;ll wire it into the live header.
      </p>
    </div>
  );
}

function WordmarkRow({ variant }: { variant: VariantProps }) {
  return (
    <div className="border-t border-ink/15 first:border-t-0 py-8 grid grid-cols-1 sm:grid-cols-[--spacing(28)_1fr] gap-6 sm:gap-10">
      <div>
        <div className="font-display text-lg italic">{variant.name}</div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
          {variant.id}
        </div>
        <p className="mt-3 text-sm text-pretty text-ink-soft leading-relaxed max-w-[40ch]">
          {variant.note}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {/* Header mockup — ink */}
        <div className="border border-ink/15 bg-paper">
          <div className="px-6 py-3.5 flex items-center justify-between gap-6 border-b border-ink/10">
            <div className="flex items-center gap-3">
              <ReflectionShimmerLogo
                className="text-ink"
                style={{ width: "20px", height: "20px", transform: "translateY(2px)" }}
              />
              <span className="text-ink">{variant.wordmark}</span>
            </div>
            <nav className="flex items-baseline gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              <span>events</span>
              <span>subscribe</span>
              <span className="text-ink">submit</span>
            </nav>
          </div>
        </div>
        {/* Header mockup — burgundy hover */}
        <div className="border border-ink/15 bg-paper">
          <div className="px-6 py-3.5 flex items-center justify-between gap-6 border-b border-ink/10">
            <div className="flex items-center gap-3">
              <ReflectionShimmerLogo
                className="text-sunset-deep"
                style={{ width: "20px", height: "20px", transform: "translateY(2px)" }}
              />
              <span className="text-sunset-deep">{variant.wordmark}</span>
            </div>
            <nav className="flex items-baseline gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              <span>events</span>
              <span>subscribe</span>
              <span className="text-ink">submit</span>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
