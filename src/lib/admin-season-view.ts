import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";
import { SEASON_PHASE, SEASON_STATUS } from "./season-constants";

export type AdminSeasonOption = {
  id: string;
  number: number;
  name: string;
  isLive: boolean;
  isArchive: boolean;
};

export type AdminSeasonViewContext = {
  /** Season currently shown in admin lists. */
  view: AdminSeasonOption;
  options: AdminSeasonOption[];
  /** True when viewing a non-live season — lists are read-only. */
  readOnly: boolean;
  /** Public site query value (`1` or season id) for archive links. */
  publicSeasonParam: string;
};

function toOption(
  row: {
    id: string;
    number: number;
    name: string;
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
      orderBy: { number: "desc" },
      select: {
        id: true,
        number: true,
        name: true,
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
 * `?season=` accepts number or id; default = live season (or newest).
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

  const raw = seasonParam?.trim() ?? "";
  let view = fallback;
  if (raw) {
    const asNum = Number(raw);
    const matched = options.find(
      (o) =>
        o.id === raw ||
        (Number.isFinite(asNum) && o.number === asNum),
    );
    if (matched) view = matched;
  }

  return {
    view,
    options,
    readOnly: !view.isLive,
    publicSeasonParam: String(view.number),
  };
}

export function adminSeasonQuery(seasonNumber: number, isLive: boolean) {
  if (isLive) return "";
  return `?season=${seasonNumber}`;
}
