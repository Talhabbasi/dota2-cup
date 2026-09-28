import { cookies } from "next/headers";
import { SEASON_VIEW_COOKIE } from "./season-view-cookie";
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
  isLive: boolean;
  isArchive: boolean;
  championName: string | null;
};

/** Parse `?season=` (id or number). Empty → cookie → live → newest. */
export async function resolveViewSeason(input?: {
  season?: string | null;
}): Promise<ResolvedViewSeason | null> {
  const param = input?.season?.trim();
  if (param) {
    const row = await getSeasonByIdOrNumber(param);
    if (!row) return null;
    return toResolved(row);
  }

  const jar = await cookies();
  const cookie = jar.get(SEASON_VIEW_COOKIE)?.value?.trim();
  if (cookie) {
    const row = await getSeasonByIdOrNumber(cookie);
    if (row) return toResolved(row);
  }

  const live = await getLiveSeason();
  if (live) {
    const row = await getSeasonByIdOrNumber(String(live.number));
    return row ? toResolved(row) : null;
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
