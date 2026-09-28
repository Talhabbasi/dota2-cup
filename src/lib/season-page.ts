import { resolveViewSeason } from "./season-view";
import { getLiveSeason } from "./seasons";

export async function getPublicSeasonContext(searchParams?: {
  season?: string;
}) {
  const view = await resolveViewSeason({ season: searchParams?.season });
  const live = await getLiveSeason();
  const seasonId = view?.id ?? live?.id ?? null;
  return { view, live, seasonId };
}
