import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminDiscordId } from "@/lib/constants";
import { HUB_GAME_COOKIE, pathLocksGame } from "@/lib/hub-game";
import { isLoginSessionFresh } from "@/lib/session-lifetime";

const HUB_GAME_MAX_AGE = 60 * 60 * 24 * 180;

function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function withHubGameCookie(response: NextResponse, game: "DOTA" | "PUBG") {
  response.cookies.set(HUB_GAME_COOKIE, game, {
    path: "/",
    maxAge: HUB_GAME_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}

/**
 * Hard gate for organizer routes + hub game preference cookie on cup entry paths.
 * `/admin` itself stays reachable for sign-in; every nested path requires isAdmin.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const lockedGame = pathLocksGame(pathname);
  if (lockedGame) {
    return withHubGameCookie(nextWithPath(request), lockedGame);
  }

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
  if (!isLoginSessionFresh(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

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
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dota",
    "/dota/:path*",
    "/pubg",
    "/pubg/:path*",
    "/fantasy",
    "/fantasy/:path*",
    "/heroes",
    "/heroes/:path*",
    "/playoffs",
    "/playoffs/:path*",
    "/predictions",
    "/predictions/:path*",
  ],
};
