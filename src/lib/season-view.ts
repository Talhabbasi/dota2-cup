import {
  getLiveSeason,
  getSeasonByIdOrNumber,
  listPublicSeasons,
  type PublicSeasonRow,
} from "./seasons";

export { SEASON_VIEW_COOKIE } from "./season-view-cookie";

export type ResolvedViewSeason = {
  id: string;
  number: number;
  name: string;
  phase: string;
  plannedStartAt: string | null;
  startedAt: string | null;
  tournamentFormat: string;
  teamCount: number;
  game: string;
  isLive: boolean;
  isArchive: boolean;
  championName: string | null;
};

/**
 * Public season context.
 * Only an explicit `?season=` query selects a non-live season (archive links).
 * Cookie is ignored so the main site never sticks on a past season.
 */
export async function resolveViewSeason(input?: {
  season?: string | null;
}): Promise<ResolvedViewSeason | null> {
  const param = input?.season?.trim();
  if (param) {
    const row = await getSeasonByIdOrNumber(param);
    if (!row) return null;
    return toResolved(row);
  }

  const live = await getLiveSeason();
  if (live) {
    return {
      id: live.id,
      number: live.number,
      name: live.name,
      phase: live.phase,
      plannedStartAt: live.plannedStartAt
        ? live.plannedStartAt.toISOString()
        : null,
      startedAt: live.startedAt ? live.startedAt.toISOString() : null,
      tournamentFormat: live.tournamentFormat,
      teamCount: live.teamCount,
      game: live.game,
      isLive: true,
      isArchive: false,
      championName: null,
    };
  }

  const seasons = await listPublicSeasons();
  const newest = seasons[0] ?? null;
  return newest ? toResolved(newest) : null;
}

function toResolved(row: PublicSeasonRow): ResolvedViewSeason {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    phase: row.phase,
    plannedStartAt: row.plannedStartAt
      ? row.plannedStartAt.toISOString()
      : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    tournamentFormat: row.tournamentFormat,
    teamCount: row.teamCount,
    game: row.game,
    isLive: row.isActive,
    isArchive: row.status === "archived" || row.phase === "COMPLETED",
    championName: row.championName,
  };
}

/** Prisma `where` spread for public live-cup reads (never all seasons). */
export async function seasonScopeForRead(
  viewSeasonId?: string | null,
): Promise<{ seasonId: string }> {
  if (viewSeasonId) return { seasonId: viewSeasonId };
  const live = await getLiveSeason();
  return { seasonId: live?.id ?? "__none__" };
}
