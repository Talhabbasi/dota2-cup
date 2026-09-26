import { prisma } from "./prisma";
import { normalizeAlias } from "./player-aliases";

/** Remember a scoreboard board name as a stand-in for future OCR + bulk fixes. */
export async function rememberStandInBoardName(boardName: string) {
  const label = boardName.trim();
  if (!label) return null;
  const alias = normalizeAlias(label);
  if (alias.length < 2) return null;

  return prisma.scoreboardStandInName.upsert({
    where: { alias },
    create: { alias, label },
    update: { label },
  });
}

export async function isRememberedStandInName(boardName: string) {
  const alias = normalizeAlias(boardName.trim());
  if (!alias) return false;
  const row = await prisma.scoreboardStandInName.findUnique({
    where: { alias },
  });
  return Boolean(row);
}

export async function listStandInAliasSet() {
  const rows = await prisma.scoreboardStandInName.findMany({
    select: { alias: true },
  });
  return new Set(rows.map((row) => row.alias));
}

/**
 * Find other match seats whose boardName normalizes to the same key.
 * Prisma can't normalize in SQL easily, so filter in memory (cup-scale OK).
 */
export async function listMatchSeatsByBoardName(
  boardName: string,
  excludeSeatId?: string,
) {
  const key = normalizeAlias(boardName);
  if (!key) return [];

  const seats = await prisma.matchPlayer.findMany({
    where: {
      boardName: { not: "" },
      ...(excludeSeatId ? { id: { not: excludeSeatId } } : {}),
    },
    select: {
      id: true,
      boardName: true,
      playerId: true,
      asStandIn: true,
      unknown: true,
      matchId: true,
    },
  });

  return seats.filter((seat) => normalizeAlias(seat.boardName) === key);
}
