import { ALL_LOGOS } from "@/components/logos";

export const metadata = {
  title: "Logo studies - Utah Tech Events",
};

const FAVICON_SIZES = [16, 32, 48, 64] as const;

export default function LogosPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Logo studies · v2
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight italic">
        Six marks for utahtech.events.
      </h1>
      <p className="mt-4 max-w-[62ch] text-pretty text-ink-soft leading-relaxed">
        All marks now square so they survive favicon use. Each shown in the actual editorial header, at every favicon size in a bounded box, and at display size in both ink and burgundy. Tell me which one (or which to combine) and I&apos;ll wire it into the header, favicon, apple-touch-icon, and og:image.
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

            {/* Header mockup — actual editorial header */}
            <div className="border border-ink/15 bg-paper">
              <div className="px-6 py-3.5 flex items-center justify-between gap-6 border-b border-ink/10">
                <div className="flex items-center gap-3">
                  <Component
                    className="text-ink"
                    style={{ width: "20px", height: "20px", transform: "translateY(2px)" }}
                  />
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

            {/* Favicon-size studies (square bounded boxes, like actual browser favicons) */}
            <div className="mt-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft mb-3">
                favicon sizes (bounded square)
              </p>
              <div className="flex items-end flex-wrap gap-4">
                {FAVICON_SIZES.map((size) => (
                  <FaviconBox key={size} size={size}>
                    <Component
                      className="text-ink"
                      style={{ width: `${size}px`, height: `${size}px` }}
                    />
                  </FaviconBox>
                ))}
              </div>
            </div>

            {/* Display + burgundy hover preview */}
            <div className="mt-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft mb-3">
                display + hover state
              </p>
              <div className="flex items-end gap-8">
                <div className="flex flex-col items-start gap-2">
                  <Component
                    className="text-ink"
                    style={{ width: "128px", height: "128px" }}
                  />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
                    128 · ink
                  </span>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <Component
                    className="text-sunset-deep"
                    style={{ width: "128px", height: "128px" }}
                  />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
                    128 · burgundy
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm text-pretty text-ink-soft max-w-[68ch] leading-relaxed">
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

function FaviconBox({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className="border border-ink/15 flex items-center justify-center bg-paper"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {children}
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
        {size}
      </span>
    </div>
  );
}
