import { CUP_GAME, parseCupGame, type CupGame } from "@/lib/games";

/** Preferred game after the user enters a cup from the hub. */
export const HUB_GAME_COOKIE = "mm_hub_game";

export function parseHubGame(value: string | null | undefined): CupGame | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (upper === CUP_GAME.PUBG) return CUP_GAME.PUBG;
  if (upper === CUP_GAME.DOTA) return CUP_GAME.DOTA;
  return null;
}

/**
 * Chrome / branding game for a request.
 * Path wins, then hub cookie, then live season, then Dota.
 */
const DOTA_PATHS = ["/dota", "/fantasy", "/heroes", "/playoffs", "/predictions"];

export function pathLocksGame(pathname: string): CupGame | null {
  if (pathname === "/pubg" || pathname.startsWith("/pubg/")) return CUP_GAME.PUBG;
  if (DOTA_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return CUP_GAME.DOTA;
  }
  return null;
}

export function resolveChromeGame(input: {
  pathname?: string | null;
  cookieGame?: CupGame | null;
  liveGame?: string | null;
}): CupGame {
  const locked = pathLocksGame(input.pathname ?? "");
  if (locked) return locked;
  if (input.cookieGame) return input.cookieGame;
  if (input.liveGame) return parseCupGame(input.liveGame);
  return CUP_GAME.DOTA;
}

export function isHubPath(pathname: string | null | undefined) {
  const path = pathname ?? "";
  return path === "/" || path === "/blog" || path.startsWith("/blog/");
}
