import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip check for static files, api routes, and system files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // e.g. .ico, .png
  ) {
    return NextResponse.next();
  }

  const onboardingComplete = request.cookies.get("onboarding_complete")?.value === "1";
  const hasToken = request.cookies.has("auth_token");

  // 3. If onboarding is not complete and user is authenticated, redirect to /setup
  if (!onboardingComplete && pathname !== "/setup" && hasToken) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
