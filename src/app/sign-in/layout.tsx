import { ClerkProvider } from "@clerk/nextjs";

/* Sign-in routes need ClerkProvider in the React tree so the SignIn
   component can render. Keeping it scoped to this route group so public
   pages don't pull Clerk's JS bundle or trigger the handshake redirect. */
export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
