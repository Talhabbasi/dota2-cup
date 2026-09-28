/** Client-safe season enums/labels — keep free of Prisma/Discord imports. */

export const SEASON_STATUS = {
  upcoming: "upcoming",
  live: "live",
  archived: "archived",
} as const;

export const SEASON_PHASE = {
  UPCOMING: "UPCOMING",
  AUCTION_ACTIVE: "AUCTION_ACTIVE",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export const TOURNAMENT_FORMAT = {
  AUCTION_BASED: "AUCTION_BASED",
  TEAM_BASED: "TEAM_BASED",
} as const;

export const ALLOWED_TEAM_COUNTS = [8, 10, 12] as const;

/** Default series lengths — fixtures can override via admin `bestOf`. */
export const REGULAR_BEST_OF = 1;
export const FINAL_BEST_OF = 3;

export type SeasonStatus = (typeof SEASON_STATUS)[keyof typeof SEASON_STATUS];

export function formatSeasonLabel(season: {
  number: number;
  name?: string | null;
  status?: string | null;
}) {
  const name = season.name?.trim() || `Season ${season.number}`;
  const status = season.status?.trim();
  return status
    ? `Season ${season.number} · ${name} (${status})`
    : `Season ${season.number} · ${name}`;
}

/** Public-facing date in Pakistan time, e.g. "20 Oct 2026". */
export function formatSeasonStartDate(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

/**
 * Hero / nav line from admin season fields, e.g.
 * "Season 2 · 10 teams · starts 20 Oct 2026"
 *
 * Always prefer Planned start (admin date). `startedAt` is only a fallback —
 * activating a season stamps startedAt immediately and must not override the
 * advertised tournament date.
 */
export function seasonPlanLine(season: {
  number: number;
  teamCount: number;
  plannedStartAt?: Date | string | null;
  startedAt?: Date | string | null;
  phase?: string | null;
}): string {
  const label = `Season ${season.number}`;
  const teams = `${season.teamCount} team${season.teamCount === 1 ? "" : "s"}`;
  const planned = formatSeasonStartDate(season.plannedStartAt);
  if (planned) {
    if (season.phase === SEASON_PHASE.COMPLETED) {
      return `${label} · ${teams} · ${planned}`;
    }
    return `${label} · ${teams} · starts ${planned}`;
  }
  const started = formatSeasonStartDate(season.startedAt);
  if (started) {
    return season.phase === SEASON_PHASE.COMPLETED
      ? `${label} · ${teams} · ${started}`
      : `${label} · ${teams} · started ${started}`;
  }
  return `${label} · ${teams}`;
}

export function tournamentFormatLabel(format: string | null | undefined) {
  if (format === TOURNAMENT_FORMAT.TEAM_BASED) return "Team-based";
  return "Auction-based";
}
