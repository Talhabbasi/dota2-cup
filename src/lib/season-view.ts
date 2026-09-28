import { cookies } from "next/headers";
import { SEASON_VIEW_COOKIE } from "./season-view-cookie";
import {
  getLiveSeason,
  getSeasonByIdOrNumber,
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

/** Parse `?season=` (id or number). Empty → use cookie → live season. */
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
  if (!live) return null;
  const row = await getSeasonByIdOrNumber(String(live.number));
  return row ? toResolved(row) : null;
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

/** Prisma `where` spread for public reads. */
export async function seasonScopeForRead(
  viewSeasonId?: string | null,
): Promise<{ seasonId?: string }> {
  if (viewSeasonId) return { seasonId: viewSeasonId };
  const live = await getLiveSeason();
  return live?.id ? { seasonId: live.id } : {};
}
