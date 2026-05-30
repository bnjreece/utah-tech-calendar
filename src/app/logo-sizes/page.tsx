import { ReflectionShimmerLogo } from "@/components/logos";

export const metadata = {
  title: "Logo size studies - Utah Tech Events",
};

interface Treatment {
  id: string;
  label: string;
  note: string;
  logoPx: number;
  wordmarkClass: string;
  translateY: number;
}

const TREATMENTS: Treatment[] = [
  {
    id: "16",
    label: "16px logo · text-sm wordmark",
    note: "Footer-scale. Whisper-quiet. Currently used in footer.",
    logoPx: 16,
    wordmarkClass: "text-sm",
    translateY: 1,
  },
  {
    id: "20",
    label: "20px logo · text-base wordmark",
    note: "Current header. Calibrated to the wordmark x-height.",
    logoPx: 20,
    wordmarkClass: "text-base",
    translateY: 2,
  },
  {
    id: "24",
    label: "24px logo · text-lg wordmark",
    note: "Quietly assertive. Wordmark still bookish, logo reads as a real mark.",
    logoPx: 24,
    wordmarkClass: "text-lg",
    translateY: 2,
  },
  {
    id: "28",
    label: "28px logo · text-xl wordmark",
    note: "Editorial-prominent. Header starts to feel like an awning, not a label.",
    logoPx: 28,
    wordmarkClass: "text-xl",
    translateY: 3,
  },
  {
    id: "32",
    label: "32px logo · text-2xl wordmark",
    note: "Masthead energy. Header carries the brand on its own.",
    logoPx: 32,
    wordmarkClass: "text-2xl",
    translateY: 3,
  },
  {
    id: "40",
    label: "40px logo · text-3xl wordmark",
    note: "Maximum. Likely too much above the schedule, but a fun datum.",
    logoPx: 40,
    wordmarkClass: "text-3xl",
    translateY: 4,
  },
];

export default function LogoSizesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Logo size studies
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        How loud should the mark be?
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-base text-ink-soft leading-relaxed">
        Six treatments of the locked Reflection Shimmer mark, each shown in
        the actual editorial header it would inhabit. Logo and wordmark scale
        together so you can read the relationship, not just the dot. Pick one
        (or two for a desktop vs mobile split) and I&apos;ll swap it in.
      </p>

      <ul role="list" className="mt-14 flex flex-col gap-12">
        {TREATMENTS.map((t) => (
          <li key={t.id} className="border-t-2 border-ink pt-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
              <h2 className="font-display text-xl sm:text-2xl italic tracking-tight">
                {t.label}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                option {t.id}
              </span>
            </div>

            {/* Full header mock at desktop width */}
            <div className="border border-ink/15 bg-paper">
              <div className="px-6 py-3.5 flex items-center justify-between gap-6 border-b border-ink/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ReflectionShimmerLogo
                    className="text-ink shrink-0"
                    style={{
                      width: `${t.logoPx}px`,
                      height: `${t.logoPx}px`,
                      transform: `translateY(${t.translateY}px)`,
                    }}
                  />
                  <span
                    className={`font-display ${t.wordmarkClass} tracking-tight leading-none`}
                  >
                    utah tech <span className="italic">events</span>
                  </span>
                </div>
                <nav className="flex items-baseline gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                  <span>events</span>
                  <span>subscribe</span>
                  <span className="text-ink">submit</span>
                </nav>
              </div>
            </div>

            {/* Mobile width mock — 320px viewport simulation */}
            <p className="mt-4 mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
              at 320px (mobile floor)
            </p>
            <div className="border border-ink/15 bg-paper" style={{ width: "320px" }}>
              <div className="px-4 py-3.5 flex items-center justify-between gap-4 border-b border-ink/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ReflectionShimmerLogo
                    className="text-ink shrink-0"
                    style={{
                      width: `${t.logoPx}px`,
                      height: `${t.logoPx}px`,
                      transform: `translateY(${t.translateY}px)`,
                    }}
                  />
                  <span
                    className={`font-display ${t.wordmarkClass} tracking-tight leading-none truncate`}
                  >
                    utah tech <span className="italic">events</span>
                  </span>
                </div>
                <nav className="flex items-baseline gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft shrink-0">
                  <span>subscribe</span>
                  <span className="text-ink">submit</span>
                </nav>
              </div>
            </div>

            <p className="mt-4 text-sm text-pretty text-ink-soft max-w-[62ch] leading-relaxed">
              {t.note}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-16 pt-6 border-t border-ink/15 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        Pick a number and I&apos;ll swap it in. Hybrid choice ok (e.g. 24 desktop, 20 mobile).
      </p>
    </div>
  );
}
