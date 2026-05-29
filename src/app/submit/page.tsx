import { SubmitForm } from "@/components/submit-form";

export const metadata = {
  title: "Submit an event - Utah Tech Events",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Submit an event</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Real, in-person Utah tech events welcome. We review every submission before publishing.
      </p>
      <SubmitForm />
    </div>
  );
}
