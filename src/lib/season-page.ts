import type { CupGame } from "./games";
import { resolveRequestGame } from "./site-game";
import { listSeasonsForGame, resolveGameSeason } from "./season-view";
import { getLiveSeason, type PublicSeasonRow } from "./seasons";

/**
 * Lists follow the game the visitor is in (path, then cookie), not whichever
 * season happens to be the global live cup. `?season=dota-2` selects one row.
 */
export async function getPublicSeasonContext(
  searchParams?: { season?: string },
  game?: CupGame,
) {
  const scoped = game ?? (await resolveRequestGame());
  const [live, view, seasons] = await Promise.all([
    getLiveSeason(),
    resolveGameSeason(scoped, searchParams?.season),
    listSeasonsForGame(scoped),
  ]);
  return {
    view,
    live,
    seasonId: view?.id ?? null,
    game: scoped,
    seasons,
  };
}

export type { PublicSeasonRow };
