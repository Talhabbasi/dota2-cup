import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminDiscordId } from "@/lib/constants";

/**
 * Hard gate for organizer routes.
 * `/admin` itself stays reachable for sign-in; every nested path requires isAdmin.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname === "/admin/") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const discordId =
    (typeof token?.discordId === "string" && token.discordId) ||
    (typeof token?.sub === "string" && token.sub) ||
    "";
  // JWT isAdmin can go stale after env allowlist updates; also trust listed Discord ids.
  const allowed =
    token?.isAdmin === true ||
    (discordId ? isAdminDiscordId(discordId) : false);

  if (!allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
