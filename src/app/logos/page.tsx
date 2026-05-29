import { ALL_LOGOS } from "@/components/logos";

export const metadata = {
  title: "Logo studies - Utah Tech Events",
};

export default function LogosPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Logo studies
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        Six marks for utahtech.events.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft">
        Three from my own creative direction. Three with ui.sh design discipline plus my take. Each shown in the actual header context, at favicon sizes, and in the burgundy hover state. Tell me which one (or which to combine) and I&apos;ll lock it into the header, favicon, social card, and `apple-touch-icon`.
      </p>

      <ul role="list" className="mt-14 flex flex-col gap-14">
        {ALL_LOGOS.map(({ id, name, category, description, Component }) => (
          <li key={id} className="border-t-2 border-ink pt-6">
            <div className="flex items-baseline justify-between gap-3 mb-6">
              <h2 className="font-display text-2xl italic">{name}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                {category}
              </span>
            </div>

            {/* Header mockup: the actual editorial header bar */}
            <div className="border border-ink/15 bg-paper">
              <div className="px-6 py-3.5 flex items-center justify-between gap-6 border-b border-ink/10">
                <div className="flex items-center gap-3">
                  <Component className="text-ink" style={{ height: "20px", width: "auto" }} />
                  <span className="font-display text-base tracking-tight leading-none">
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

            {/* Size studies */}
            <div className="mt-6 flex items-end flex-wrap gap-8">
              <SizeStudy label="16">
                <Component className="text-ink" style={{ width: "16px", height: "auto" }} />
              </SizeStudy>
              <SizeStudy label="32">
                <Component className="text-ink" style={{ width: "32px", height: "auto" }} />
              </SizeStudy>
              <SizeStudy label="64">
                <Component className="text-ink" style={{ width: "64px", height: "auto" }} />
              </SizeStudy>
              <SizeStudy label="128">
                <Component className="text-ink" style={{ width: "128px", height: "auto" }} />
              </SizeStudy>
              <SizeStudy label="128 · burgundy">
                <Component className="text-sunset-deep" style={{ width: "128px", height: "auto" }} />
              </SizeStudy>
            </div>

            <p className="mt-5 text-sm text-pretty text-ink-soft max-w-[68ch] leading-relaxed">
              {description}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-16 pt-6 border-t border-ink/15 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        Tell me your pick. I&apos;ll wire it into the header + favicon + og:image.
      </p>
    </div>
  );
}

function SizeStudy({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-end min-h-[128px]">{children}</div>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </span>
    </div>
  );
}
