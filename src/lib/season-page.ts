import { resolveViewSeason } from "./season-view";
import { getLiveSeason } from "./seasons";

/**
 * Default: live season. Explicit `?season=` (id or number) selects an archive
 * cup — used on player/team profiles and deep links from season pages.
 */
export async function getPublicSeasonContext(searchParams?: {
  season?: string;
}) {
  const live = await getLiveSeason();
  const view = await resolveViewSeason({ season: searchParams?.season });
  const seasonId = view?.id ?? live?.id ?? null;
  return { view, live, seasonId };
}
