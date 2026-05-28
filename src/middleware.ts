export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect everything EXCEPT:
     *  - /login              (the login page itself)
     *  - /api/auth/**        (NextAuth endpoints)
     *  - /api/users/count    (bootstrap detection)
     *  - /_next/**           (Next.js internals / static assets)
     *  - /favicon.ico
     */
    "/((?!login|api/auth|api/users/count|_next|favicon\\.ico).*)",
  ],
};
