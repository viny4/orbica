import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Only protect the /sync-logs path
  if (request.nextUrl.pathname.startsWith("/sync-logs")) {
    const adminToken = request.cookies.get("admin_token");
    
    // In a real app, you would verify a JWT. 
    // Here we just check if the cookie exists and has the expected value
    // (set by our login route when credentials match).
    if (!adminToken || adminToken.value !== "authenticated") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sync-logs/:path*"],
};
