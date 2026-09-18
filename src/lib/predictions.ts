import { prisma } from "./prisma";
import { publicFixtureWhere, publicPlayerWhere } from "./dummy";
import { isPlayoffKind, playoffRoundLabel } from "./playoff";
import { formatScheduleWhen } from "./schedule";
import {
  groupScheduleByNight,
  listCupSchedule,
  type ScheduleFixtureView,
} from "./schedule-crud";
import {
  currentSeasonFilter,
  currentSeasonId,
  getCurrentSeasonSafe,
} from "./seasons";

export const PREDICTION_POINTS = 10;
export const FINAL_PREDICTION_POINTS = 50;

export function isGrandFinalFixture(kind: string, slotKey?: string | null) {
  return kind === "final" || slotKey === "final";
}

export function isGroupStagePredictionFixture(kind: string) {
  return kind === "group" || kind === "regular";
}

export function isInternationalPredictionFixture(kind: string) {
  return !isGroupStagePredictionFixture(kind);
}

export function predictionPointsFor(kind: string, slotKey?: string | null) {
  return isGrandFinalFixture(kind, slotKey)
    ? FINAL_PREDICTION_POINTS
    : PREDICTION_POINTS;
}

export function groupStageLockAt(
  fixtures: { kind: string; scheduledAt: Date }[],
) {
  const group = fixtures.filter((row) =>
    isGroupStagePredictionFixture(row.kind),
  );
  if (group.length === 0) return null;
  return group.reduce(
    (earliest, row) =>
      row.scheduledAt < earliest ? row.scheduledAt : earliest,
    group[0].scheduledAt,
  );
}

export function isGroupStageLocked(lockAt: Date | null, now = new Date()) {
  return Boolean(lockAt && now >= lockAt);
}

export function groupStageIsComplete(
  fixtures: { kind: string; status: string }[],
) {
  const group = fixtures.filter((row) =>
    isGroupStagePredictionFixture(row.kind),
  );
  return group.length > 0 && group.every((row) => row.status === "completed");
}

export function seriesWinnerTeamId(fixture: {
  status: string;
  radiantWins: number;
  direWins: number;
  radiantTeamId: string;
  direTeamId: string;
  match?: { winnerTeamId: string | null } | null;
}) {
  if (fixture.status !== "completed") return null;
  if (fixture.radiantWins > fixture.direWins) return fixture.radiantTeamId;
  if (fixture.direWins > fixture.radiantWins) return fixture.direTeamId;
  return fixture.match?.winnerTeamId ?? null;
}

function roundLabel(fixture: Pick<ScheduleFixtureView, "kind" | "slotKey">) {
  if (isGrandFinalFixture(fixture.kind, fixture.slotKey)) return "Grand Final";
  if (isPlayoffKind(fixture.kind)) {
    return playoffRoundLabel(fixture.kind, fixture.slotKey);
  }
  if (fixture.kind === "group") return "Group stage";
  return "Group stage";
}

export type PredictionMatchView = {
  id: string;
  roundLabel: string;
  whenLabel: string;
  bestOf: number;
  points: number;
  locked: boolean;
  completed: boolean;
  radiantWins: number;
  direWins: number;
  radiant: { id: string; name: string };
  dire: { id: string; name: string };
  winnerTeamId: string | null;
  myPickId: string | null;
};

export type PredictionNightView = {
  label: string;
  fixtures: PredictionMatchView[];
};

export type PredictionLeaderRow = {
  rank: number;
  playerId: string;
  name: string;
  points: number;
  correct: number;
  picks: number;
  barPct: number;
  isYou: boolean;
};

const MAX_PREDICTION_BATCH = 40;

export type PredictionPickInput = {
  fixtureId: string;
  teamId: string;
};

export async function saveMatchPredictions(
  playerId: string,
  picks: PredictionPickInput[],
) {
  const unique = new Map<string, string>();
  for (const pick of picks) {
    const fixtureId = pick.fixtureId?.trim();
    const teamId = pick.teamId?.trim();
    if (!fixtureId || !teamId) {
      throw new Error("Pick a match and a team.");
    }
    unique.set(fixtureId, teamId);
  }
  if (unique.size === 0) {
    throw new Error("Pick a match and a team.");
  }
  if (unique.size > MAX_PREDICTION_BATCH) {
    throw new Error("Save fewer picks at once.");
  }

  const season = await currentSeasonFilter();
  const seasonFixtures = await prisma.scheduledFixture.findMany({
    where: { ...publicFixtureWhere, ...season },
    select: {
      id: true,
      kind: true,
      scheduledAt: true,
      status: true,
      radiantTeamId: true,
      direTeamId: true,
      seasonId: true,
    },
  });
  const byId = new Map(seasonFixtures.map((row) => [row.id, row]));
  const groupLocked = isGroupStageLocked(groupStageLockAt(seasonFixtures));
  const groupsDone = groupStageIsComplete(seasonFixtures);
  const fallbackSeasonId =
    seasonFixtures.find((row) => row.seasonId)?.seasonId ??
    (await currentSeasonId());

  const rows = [...unique.entries()].map(([fixtureId, teamId]) => {
    const fixture = byId.get(fixtureId);
    if (!fixture) {
      throw new Error("That match is not on this cup.");
    }
    if (isGroupStagePredictionFixture(fixture.kind)) {
      if (groupLocked) {
        throw new Error(
          "Group stage picks locked at Saturday 10:00 PM PKT, before the first match.",
        );
      }
    } else if (isInternationalPredictionFixture(fixture.kind)) {
      if (!groupsDone) {
        throw new Error(
          "The International unlocks after every group-stage match is done.",
        );
      }
      if (fixture.status === "completed" || new Date() >= fixture.scheduledAt) {
        throw new Error("That series is locked.");
      }
    } else {
      throw new Error("That match is not on this cup.");
    }
    if (teamId !== fixture.radiantTeamId && teamId !== fixture.direTeamId) {
      throw new Error("Pick one of the two teams in this series.");
    }
    return {
      fixtureId,
      teamId,
      seasonId: fixture.seasonId ?? fallbackSeasonId,
    };
  });

  await prisma.$transaction(
    rows.map((row) =>
      prisma.matchPrediction.upsert({
        where: {
          playerId_fixtureId: {
            playerId,
            fixtureId: row.fixtureId,
          },
        },
        create: {
          playerId,
          fixtureId: row.fixtureId,
          predictedTeamId: row.teamId,
          seasonId: row.seasonId,
        },
        update: { predictedTeamId: row.teamId },
      }),
    ),
  );

  return { saved: rows.length };
}

export async function saveMatchPrediction(input: {
  playerId: string;
  fixtureId: string;
  teamId: string;
}) {
  return saveMatchPredictions(input.playerId, [
    { fixtureId: input.fixtureId, teamId: input.teamId },
  ]);
}

export async function scorePredictionsForFixture(fixtureId: string) {
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id: fixtureId },
    include: { match: { select: { winnerTeamId: true } } },
  });
  if (!fixture || fixture.status !== "completed") return;

  const winnerId = seriesWinnerTeamId(fixture);
  if (!winnerId) return;

  const points = predictionPointsFor(fixture.kind, fixture.slotKey);
  const picks = await prisma.matchPrediction.findMany({
    where: { fixtureId },
  });
  const scoredAt = new Date();

  await Promise.all(
    picks.map((pick) =>
      prisma.matchPrediction.update({
        where: { id: pick.id },
        data: {
          pointsAwarded: pick.predictedTeamId === winnerId ? points : 0,
          scoredAt,
        },
      }),
    ),
  );
}

function toMatchView(
  fixture: ScheduleFixtureView,
  myPickId: string | null,
  stageLocked: boolean,
  now: Date,
): PredictionMatchView {
  const matchLocked =
    stageLocked ||
    fixture.status === "completed" ||
    now >= fixture.scheduledAt;
  return {
    id: fixture.id,
    roundLabel: roundLabel(fixture),
    whenLabel: formatScheduleWhen(fixture.scheduledAt),
    bestOf: fixture.bestOf ?? 1,
    points: predictionPointsFor(fixture.kind, fixture.slotKey),
    locked: matchLocked,
    completed: fixture.status === "completed",
    radiantWins: fixture.radiantWins ?? 0,
    direWins: fixture.direWins ?? 0,
    radiant: { id: fixture.radiantTeam.id, name: fixture.radiantTeam.name },
    dire: { id: fixture.direTeam.id, name: fixture.direTeam.name },
    winnerTeamId: seriesWinnerTeamId(fixture),
    myPickId,
  };
}

export type PredictionStageView = {
  nights: PredictionNightView[];
  openCount: number;
  stageLocked: boolean;
  lockLabel: string | null;
};

function nightsFor(
  fixtures: ScheduleFixtureView[],
  pickByFixture: Map<string, string>,
  stageLocked: boolean,
  now: Date,
): PredictionNightView[] {
  return groupScheduleByNight(fixtures).map((night) => ({
    label: night.label,
    fixtures: night.fixtures.map((fixture) =>
      toMatchView(
        fixture,
        pickByFixture.get(fixture.id) ?? null,
        stageLocked,
        now,
      ),
    ),
  }));
}

export async function getPredictionBoard(playerId?: string | null) {
  const now = new Date();
  const all = await listCupSchedule({ publicOnly: true });
  const group = all.filter((row) => isGroupStagePredictionFixture(row.kind));
  const international = all.filter((row) =>
    isInternationalPredictionFixture(row.kind),
  );
  const groupLockAt = groupStageLockAt(group);
  const groupLocked = isGroupStageLocked(groupLockAt, now);
  const groupsDone = groupStageIsComplete(group);
  const internationalLocked = !groupsDone;

  const ids = [...group, ...international].map((row) => row.id);
  const picks = playerId
    ? await prisma.matchPrediction
        .findMany({
          where: { playerId, fixtureId: { in: ids } },
          select: { fixtureId: true, predictedTeamId: true },
        })
        .catch(() => [])
    : [];
  const pickByFixture = new Map(
    picks.map((pick) => [pick.fixtureId, pick.predictedTeamId]),
  );

  const groupNights = nightsFor(group, pickByFixture, groupLocked, now);
  const internationalNights = nightsFor(
    international,
    pickByFixture,
    internationalLocked,
    now,
  );

  return {
    group: {
      nights: groupNights,
      openCount: groupLocked
        ? 0
        : groupNights.flatMap((night) => night.fixtures).length,
      stageLocked: groupLocked,
      lockLabel: groupLockAt ? formatScheduleWhen(groupLockAt) : null,
    } satisfies PredictionStageView,
    international: {
      nights: internationalNights,
      openCount:
        internationalLocked
          ? 0
          : internationalNights
              .flatMap((night) => night.fixtures)
              .filter((row) => !row.locked).length,
      stageLocked: internationalLocked,
      lockLabel: groupsDone
        ? null
        : "Unlocks when every group-stage match is done",
    } satisfies PredictionStageView,
  };
}

export type PredictionLeaderboardView = {
  revealed: boolean;
  playerCount: number;
  rows: PredictionLeaderRow[];
  youRank: number | null;
};

const emptyLeaderboard: PredictionLeaderboardView = {
  revealed: false,
  playerCount: 0,
  rows: [],
  youRank: null,
};

export async function getPredictionLeaderboard(youPlayerId?: string | null) {
  const season = await getCurrentSeasonSafe();
  if (!season) return emptyLeaderboard;

  const seasonFilter = await currentSeasonFilter();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: { ...publicFixtureWhere, ...seasonFilter },
    select: { kind: true, status: true },
  });
  const revealed = groupStageIsComplete(fixtures);

  if (!revealed) {
    try {
      const pickers = await prisma.matchPrediction.findMany({
        where: {
          seasonId: season.id,
          player: publicPlayerWhere,
        },
        distinct: ["playerId"],
        select: { playerId: true },
      });
      return {
        ...emptyLeaderboard,
        playerCount: pickers.length,
      };
    } catch {
      return emptyLeaderboard;
    }
  }

  let picks: {
    playerId: string;
    pointsAwarded: number;
    player: { steamName: string; discordName: string };
  }[] = [];
  try {
    picks = await prisma.matchPrediction.findMany({
      where: {
        seasonId: season.id,
        player: publicPlayerWhere,
      },
      select: {
        playerId: true,
        pointsAwarded: true,
        player: { select: { steamName: true, discordName: true } },
      },
    });
  } catch {
    return { ...emptyLeaderboard, revealed: true };
  }

  const byPlayer = new Map<
    string,
    { name: string; points: number; correct: number; picks: number }
  >();
  for (const pick of picks) {
    const current = byPlayer.get(pick.playerId) ?? {
      name: pick.player.steamName || pick.player.discordName,
      points: 0,
      correct: 0,
      picks: 0,
    };
    current.points += pick.pointsAwarded;
    current.picks += 1;
    if (pick.pointsAwarded > 0) current.correct += 1;
    byPlayer.set(pick.playerId, current);
  }

  const sorted = [...byPlayer.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    if (b[1].correct !== a[1].correct) return b[1].correct - a[1].correct;
    return a[1].name.localeCompare(b[1].name);
  });
  const maxPoints = sorted[0]?.[1].points ?? 0;

  const rows: PredictionLeaderRow[] = sorted.map(([playerId, row], index) => ({
    rank: index + 1,
    playerId,
    name: row.name,
    points: row.points,
    correct: row.correct,
    picks: row.picks,
    barPct: maxPoints > 0 ? Math.round((row.points / maxPoints) * 100) : 0,
    isYou: Boolean(youPlayerId && youPlayerId === playerId),
  }));

  return {
    revealed: true,
    playerCount: rows.length,
    rows,
    youRank: rows.find((row) => row.isYou)?.rank ?? null,
  };
}
