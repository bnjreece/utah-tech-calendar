import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    await auth.protect();
  }
});

/* Only run Clerk middleware on admin and sign-in routes. Every other
   public page (home, /event, /city, /about, /subscribe, /submit, OG
   images, sitemap, robots) skips Clerk entirely - no handshake redirect,
   no JS bundle, no third-party cookie. This was a ~730ms first-paint
   savings + ~260KB of unused Clerk JS removed from public visits per
   Lighthouse audit. */
export const config = {
  matcher: ["/admin(.*)", "/sign-in(.*)"],
};
