import { prisma } from "./prisma";

export type SeriesGameWinner = { winnerTeamId: string | null };

export type SeriesUploadPlan =
  | { kind: "bo1"; matchId: string | null }
  | { kind: "first"; matchId: string | null }
  | { kind: "append" }
  | { kind: "recover" }
  | { kind: "closed" };

/**
 * How the next scoreboard upload should behave.
 * A decided series with fewer saved maps than recorded wins can still
 * receive the missing map. That upload must not change the series score.
 */
export function planSeriesUpload(input: {
  bestOf: number;
  status: string;
  radiantWins: number;
  direWins: number;
  matchId: string | null;
  storedScoreboards: number;
}): SeriesUploadPlan {
  const bestOf = input.bestOf || 1;
  if (bestOf <= 1) return { kind: "bo1", matchId: input.matchId };
  const needed = Math.ceil(bestOf / 2);
  const recorded = input.radiantWins + input.direWins;
  const decided =
    input.status === "completed" ||
    input.radiantWins >= needed ||
    input.direWins >= needed;
  if (input.storedScoreboards <= 0) {
    return { kind: "first", matchId: input.matchId };
  }
  if (!decided && input.storedScoreboards < bestOf) return { kind: "append" };
  if (decided && input.storedScoreboards < recorded && input.storedScoreboards < bestOf) {
    return { kind: "recover" };
  }
  return { kind: "closed" };
}

export function seriesWinsFromGames(
  fixture: { radiantTeamId: string; direTeamId: string },
  games: SeriesGameWinner[],
) {
  let radiantWins = 0;
  let direWins = 0;
  for (const game of games) {
    if (game.winnerTeamId === fixture.radiantTeamId) radiantWins += 1;
    else if (game.winnerTeamId === fixture.direTeamId) direWins += 1;
  }
  return { radiantWins, direWins };
}

/**
 * Series score from saved maps.
 * A finished series is left alone when some maps were recorded without a
 * surviving scoreboard, so a 2–0 is not collapsed back to 1–0.
 */
export function nextSeriesScore(input: {
  bestOf: number;
  status: string;
  radiantWins: number;
  direWins: number;
  radiantTeamId: string;
  direTeamId: string;
  games: SeriesGameWinner[];
}) {
  const bestOf = input.bestOf || 1;
  if (bestOf <= 1) return null;
  const fromGames = seriesWinsFromGames(input, input.games);
  const counted = fromGames.radiantWins + fromGames.direWins;
  const recorded = input.radiantWins + input.direWins;
  if (counted === 0) return null;
  if (input.status === "completed" && counted < recorded) return null;
  const needed = Math.ceil(bestOf / 2);
  const seriesOver = fromGames.radiantWins >= needed || fromGames.direWins >= needed;
  if (input.status === "completed" && !seriesOver) return null;
  return {
    radiantWins: fromGames.radiantWins,
    direWins: fromGames.direWins,
    seriesOver,
  };
}

export async function attachMatchToSeries(fixtureId: string, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { seriesFixtureId: true, gameNumber: true },
  });
  if (!match) return;
  if (match.seriesFixtureId === fixtureId && match.gameNumber) return;
  const siblings = await prisma.match.findMany({
    where: { seriesFixtureId: fixtureId, NOT: { id: matchId } },
    select: { gameNumber: true },
  });
  const next =
    siblings.reduce((max, row) => Math.max(max, row.gameNumber ?? 0), 0) + 1;
  await prisma.match.update({
    where: { id: matchId },
    data: {
      seriesFixtureId: fixtureId,
      gameNumber:
        match.seriesFixtureId === fixtureId && match.gameNumber
          ? match.gameNumber
          : next,
    },
  });
}

/** Recompute a BO3+ series from its maps and score picks when it is decided. */
export async function syncSeriesFromGames(
  fixtureId: string,
  options?: { pointAtMatchId?: string | null },
) {
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id: fixtureId },
  });
  if (!fixture || (fixture.bestOf ?? 1) <= 1) return null;
  const games = await prisma.match.findMany({
    where: { seriesFixtureId: fixtureId },
    select: { winnerTeamId: true },
  });
  const next = nextSeriesScore({ ...fixture, games });
  const pointAt = options?.pointAtMatchId ?? null;
  if (!next && !pointAt) return null;

  const wasComplete = fixture.status === "completed";
  await prisma.scheduledFixture.update({
    where: { id: fixture.id },
    data: {
      ...(next
        ? {
            radiantWins: next.radiantWins,
            direWins: next.direWins,
            status: next.seriesOver ? "completed" : "scheduled",
          }
        : {}),
      ...(pointAt ? { matchId: pointAt } : {}),
    },
  });

  if (next?.seriesOver) {
    const { scorePredictionsForFixture } = await import("./predictions");
    await scorePredictionsForFixture(fixture.id);
    if (!wasComplete) {
      const { advancePlayoff } = await import("./playoff");
      await advancePlayoff(fixture.id);
      if (fixture.kind === "final" || fixture.slotKey === "final") {
        const winnerTeamId =
          next.radiantWins > next.direWins
            ? fixture.radiantTeamId
            : next.direWins > next.radiantWins
              ? fixture.direTeamId
              : null;
        if (winnerTeamId) {
          const seasons = await import("./seasons");
          await seasons.recordSeasonChampion(
            fixture.seasonId ?? (await seasons.currentSeasonId()),
            winnerTeamId,
          );
        }
      }
    }
  }
  return next;
}
