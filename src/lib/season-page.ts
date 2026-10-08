import { resolveViewSeason } from "./season-view";
import { getLiveSeason } from "./seasons";

/**
 * Main-site lists always use the active season.
 * Past cups are opened from /seasons, not `?season=` on Teams or Matches.
 */
export async function getPublicSeasonContext(_searchParams?: {
  season?: string;
}) {
  const live = await getLiveSeason();
  const view = await resolveViewSeason();
  const seasonId = live?.id ?? view?.id ?? null;
  return { view, live, seasonId };
}
