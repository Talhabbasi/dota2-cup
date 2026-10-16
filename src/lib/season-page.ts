import { resolveViewSeason } from "./season-view";
import { getLiveSeason } from "./seasons";

/**
 * Main-site lists (players, teams, matches, …) always use the live season.
 * Past cups are on /seasons and on detail pages via explicit `?season=`.
 */
export async function getPublicSeasonContext(_searchParams?: {
  season?: string;
}) {
  const live = await getLiveSeason();
  const view = await resolveViewSeason();
  const seasonId = live?.id ?? view?.id ?? null;
  return { view, live, seasonId };
}
