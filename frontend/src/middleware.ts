import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

/**
 * Lightweight route guard.
 *
 * Tokens live in localStorage (client-only), so edge middleware cannot inspect
 * them directly. Instead we check the `carbonops_auth` cookie mirror that is
 * written by the auth store on login and cleared on logout. If the cookie is
 * missing and the request targets an authenticated route, redirect to /login
 * preserving the original location via `?from=`.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const authCookie = req.cookies.get(AUTH_COOKIE)?.value;
  const isAuthed = authCookie === "1";

  const isLoginPage = pathname === "/login";

  if (!isAuthed && !isLoginPage) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isLoginPage) {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next internals, static assets, and API/favicons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
