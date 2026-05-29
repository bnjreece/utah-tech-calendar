import { SubmitForm } from "@/components/submit-form";

export const metadata = {
  title: "Submit an event - Utah Tech Events",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-ink-soft font-medium">
        Submit
      </p>
      <h1 className="mt-3 font-semibold text-4xl sm:text-5xl leading-[1.05] tracking-tight text-balance">
        Tell us about your event.
      </h1>
      <p className="mt-3 text-base text-ink-soft text-pretty">
        In-person Utah tech events welcome. Every submission gets a quick human review before it goes live.
      </p>
      <div className="mt-10 rounded-3xl bg-card ring-1 ring-ink/5 shadow-sm p-6 sm:p-8">
        <SubmitForm />
      </div>
    </div>
  );
}
