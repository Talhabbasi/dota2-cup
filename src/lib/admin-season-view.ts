import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";
import { SEASON_PHASE, SEASON_STATUS } from "./season-constants";
import { ADMIN_SEASON_COOKIE } from "./season-view-cookie";

export type AdminSeasonOption = {
  id: string;
  number: number;
  name: string;
  game: string;
  isLive: boolean;
  isArchive: boolean;
};

export type AdminSeasonViewContext = {
  /** Season currently shown in admin lists. */
  view: AdminSeasonOption;
  options: AdminSeasonOption[];
  /** True when viewing a non-live season — lists are read-only. */
  readOnly: boolean;
  /** Season id. Numbers collide once each game has its own Season 1. */
  publicSeasonParam: string;
};

function toOption(
  row: {
    id: string;
    number: number;
    name: string;
    game: string;
    status: string;
    phase: string;
    isActive: boolean;
  },
  liveId: string | null,
): AdminSeasonOption {
  const isLive = Boolean(row.isActive) || liveId === row.id;
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    game: row.game,
    isLive,
    isArchive:
      !isLive &&
      (row.status === SEASON_STATUS.archived ||
        row.phase === SEASON_PHASE.COMPLETED),
  };
}

export async function listAdminSeasonOptions(): Promise<AdminSeasonOption[]> {
  const [rows, live] = await Promise.all([
    prisma.season.findMany({
      orderBy: [{ game: "asc" }, { number: "desc" }],
      select: {
        id: true,
        number: true,
        name: true,
        game: true,
        status: true,
        phase: true,
        isActive: true,
      },
    }),
    getLiveSeason(),
  ]);
  return rows.map((row) => toOption(row, live?.id ?? null));
}

/**
 * Resolve which season admin lists should show.
 * Prefer the season id in `?season=` or the admin cookie.
 * A bare number is used only when exactly one season has that number.
 */
export async function resolveAdminSeasonView(
  seasonParam?: string | null,
): Promise<AdminSeasonViewContext> {
  const options = await listAdminSeasonOptions();
  const live = options.find((o) => o.isLive) ?? null;
  const fallback = live ?? options[0] ?? null;

  if (!fallback) {
    throw new Error("No seasons exist. Create one in Admin → Seasons.");
  }

  const cookieStore = await cookies();
  const raw =
    seasonParam?.trim() ||
    cookieStore.get(ADMIN_SEASON_COOKIE)?.value?.trim() ||
    "";
  let view = fallback;
  if (raw) {
    const byId = options.find((o) => o.id === raw);
    if (byId) {
      view = byId;
    } else {
      const asNum = Number(raw);
      const numbered = Number.isFinite(asNum)
        ? options.filter((o) => o.number === asNum)
        : [];
      if (numbered.length === 1) view = numbered[0]!;
    }
  }

  return {
    view,
    options,
    readOnly: !view.isLive,
    publicSeasonParam: view.id,
  };
}

export function adminSeasonQuery(seasonId: string) {
  return `?season=${seasonId}`;
}
