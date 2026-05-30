import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in - Utah Tech Events" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Admin
      </p>
      <h1 className="mt-3 font-display text-3xl tracking-tight italic">
        Sign in
      </h1>
      <p className="mt-3 text-base sm:text-sm text-ink-soft max-w-[40ch] text-center text-pretty">
        Restricted to the editor. Sign in with the Google account associated
        with this project.
      </p>
      <div className="mt-8">
        <SignIn appearance={{ elements: { rootBox: "shadow-none" } }} />
      </div>
    </div>
  );
}
