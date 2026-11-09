import { cookies } from "next/headers";
import { HUB_GAME_COOKIE, parseHubGame } from "@/lib/hub-game";
import type { CupGame } from "@/lib/games";

export async function readHubGameCookie(): Promise<CupGame | null> {
  const store = await cookies();
  return parseHubGame(store.get(HUB_GAME_COOKIE)?.value);
}
