import { SubmitFlow } from "@/components/submit-flow";

export const metadata = {
  title: "Submit — Utah Tech Calendar",
  description:
    "Paste an event URL and we'll extract it. Or suggest a whole calendar / source we should scrape on a recurring basis.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16 theme-editorial">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        Submit
      </p>
      <h1
        className="mt-4 font-display italic tracking-tight text-ink leading-[1.05] text-4xl sm:text-5xl"
        style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
      >
        Tell us your source. <br className="hidden sm:block" />
        We&apos;ll extract it.
      </h1>
      <p className="mt-5 max-w-[58ch] text-base sm:text-lg text-ink-soft leading-relaxed text-pretty">
        Paste a URL to one event and we&apos;ll pull the details. Or suggest a
        whole calendar and we&apos;ll wire up the scraper. Either way, no
        manual data-entry on your end.
      </p>

      <div className="mt-10">
        <SubmitFlow />
      </div>

      <div className="mt-12 border-t border-ink/12 pt-6 text-sm text-ink-soft leading-relaxed">
        <p>
          What works as a URL? Luma, Eventbrite, Meetup, plus any
          conference page that emits schema.org event structured data.
          If you have a calendar that&apos;s hand-built, use the
          &ldquo;suggest a source&rdquo; mode and we&apos;ll take a look.
        </p>
      </div>
    </div>
  );
}
