import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors without a session cookie to the login
// page. Real authorisation happens in each page / server action (requireUser).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("rbsm_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/buyer/:path*", "/fieo/:path*", "/dic/:path*", "/admin/:path*", "/api/files/:path*", "/api/reports/:path*", "/api/sellers/:path*", "/api/buyers/:path*", "/api/mou/:path*", "/district/:path*", "/taluk/:path*", "/training/:path*", "/seller/:path*", "/nodal/:path*", "/api/attachments/:path*"],
};
