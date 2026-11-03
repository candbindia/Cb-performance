// Protect every page: if not signed in, send to /login. (api/auth and static assets are skipped.)
import { auth } from "@/auth";

export default auth((req) => {
  const onLogin = req.nextUrl.pathname === "/login";
  if (!req.auth && !onLogin) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
