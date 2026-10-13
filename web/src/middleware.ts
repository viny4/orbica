import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/adminSession";

// Guards the admin-only sync log viewer. Requires a valid signed session
// (see lib/adminSession.ts) — the old check accepted any cookie whose value was
// the literal "authenticated", which anyone could set by hand.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("callbackUrl", request.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/sync-logs/:path*"],
};
