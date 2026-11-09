import { headers } from "next/headers";
import { CUP_GAME, parseCupGame, type CupGame } from "@/lib/games";
import { pathLocksGame } from "@/lib/hub-game";
import { readHubGameCookie } from "@/lib/hub-game-server";
import { getLiveSeason } from "@/lib/seasons";

/** Path lock, then the last game the visitor opened, then the live season. */
export async function resolveRequestGame(): Promise<CupGame> {
  const headerStore = await headers();
  const locked = pathLocksGame(headerStore.get("x-pathname") ?? "");
  if (locked) return locked;
  const cookie = await readHubGameCookie();
  if (cookie) return cookie;
  const live = await getLiveSeason();
  return live ? parseCupGame(live.game) : CUP_GAME.DOTA;
}
