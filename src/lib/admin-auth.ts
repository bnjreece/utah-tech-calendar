import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ADMIN_EMAILS = new Set<string>(["b@bnjmn.org"]);

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
}

/* Server-side admin gate. Use at the top of every /admin/* page.tsx
   and inside every server action that mutates admin state. */
export async function requireAdmin(): Promise<AdminUser> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const email = user.primaryEmailAddress?.emailAddress;
  if (!email || !ADMIN_EMAILS.has(email.toLowerCase())) {
    redirect("/");
  }
  return {
    id: user.id,
    email,
    firstName: user.firstName,
  };
}
