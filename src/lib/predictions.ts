import { prisma } from "./prisma";
import { getCupFeatureSettings } from "./cup-features";
import { publicFixtureWhere, publicPlayerWhere } from "./dummy";
import { isPlayoffKind, playoffRoundLabel } from "./playoff";
import {
  BRACKET_SLOTS,
  isBracketSlot,
  loadPlayoffSeeds,
  seriesWinnerLoser,
  type BracketSlot,
  type GroupSeeds,
  type SlotResult,
} from "./playoff-bracket";
import {
  pickMapFrom,
  pickemSlots,
  resolvedBracketPicks,
  type PickemSlotView,
} from "./prediction-bracket";
import {
  asDate,
  formatScheduleWhen,
  localParts,
  scheduleUtcOffsetHours,
} from "./schedule";
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
/** Group-stage picks stay open until this wall-clock time (PKT) on the Friday before the first group night. */
export const GROUP_STAGE_LOCK_HOUR_PKT = 22;
export const GROUP_STAGE_LOCK_MINUTE_PKT = 0;

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

/** Friday 10:00 PM PKT on the weekend of `reference` (PKT calendar). */
export function fridayPredictionLockAt(
  reference: Date | string | null | undefined,
) {
  if (reference == null) return null;
  const offsetH = scheduleUtcOffsetHours();
  const { year, month, day, dow } = localParts(reference, offsetH);
  // Fri=0 days back, Sat=1, Sun=2, …
  const daysBackToFriday = (dow + 2) % 7;
  return new Date(
    Date.UTC(
      year,
      month,
      day - daysBackToFriday,
      GROUP_STAGE_LOCK_HOUR_PKT,
      GROUP_STAGE_LOCK_MINUTE_PKT,
    ) -
      offsetH * 3_600_000,
  );
}

export function groupStageLockAt(
  fixtures: { kind: string; scheduledAt: Date | string }[],
) {
  const group = fixtures.filter((row) =>
    isGroupStagePredictionFixture(row.kind),
  );
  if (group.length === 0) return null;
  const earliest = group.reduce((soonest, row) => {
    const at = asDate(row.scheduledAt).getTime();
    const best = asDate(soonest).getTime();
    return at < best ? row.scheduledAt : soonest;
  }, group[0].scheduledAt);
  return fridayPredictionLockAt(earliest);
}

export function isGroupStageLocked(lockAt: Date | null, now = new Date()) {
  return Boolean(lockAt && now >= lockAt);
}

/**
 * Organizer Unlocked reopens picks even after the Friday schedule lock.
 * Organizer Locked always closes picks. Friday is when organizers usually
 * flip Locked in admin / Discord — not a hard gate once Unlocked again.
 */
export function picksClosedForOrganizer(predictionsEnabled: boolean) {
  return !predictionsEnabled;
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
  const { predictionsEnabled } = await getCupFeatureSettings();
  if (!predictionsEnabled) {
    throw new Error("Predictions are locked by an organizer.");
  }
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
      if (fixture.status === "completed") {
        throw new Error("That series is already completed.");
      }
    } else if (isInternationalPredictionFixture(fixture.kind)) {
      if (!groupsDone) {
        throw new Error(
          "The International unlocks after every group-stage match is done.",
        );
      }
      if (fixture.status === "completed") {
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

export async function saveBracketPicks(
  playerId: string,
  picks: { slotKey: string; teamId: string }[],
) {
  const { predictionsEnabled } = await getCupFeatureSettings();
  if (!predictionsEnabled) {
    throw new Error("Predictions are locked by an organizer.");
  }
  const { complete, seeds } = await loadPlayoffSeeds();
  if (!complete || !seeds) {
    throw new Error(
      "The International unlocks after every group-stage match is done.",
    );
  }

  const seasonId = await currentSeasonId();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: {
      ...publicFixtureWhere,
      slotKey: { in: [...BRACKET_SLOTS] },
    },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });

  const actual: Partial<Record<BracketSlot, SlotResult>> = {};
  const lockedSlots = new Set<BracketSlot>();
  for (const fixture of fixtures) {
    if (!isBracketSlot(fixture.slotKey)) continue;
    if (fixture.status === "completed") {
      const outcome = seriesWinnerLoser(fixture);
      if (outcome) actual[fixture.slotKey] = outcome;
      lockedSlots.add(fixture.slotKey);
    }
    // Organizer Unlocked keeps non-completed slots open even after kickoff.
  }

  const incoming = pickMapFrom(picks);
  const resolved = resolvedBracketPicks(seeds, actual, incoming).filter(
    (row) => !lockedSlots.has(row.slotKey),
  );
  if (resolved.length === 0) {
    throw new Error("Pick a winner in an open bracket match.");
  }

  const keep = new Set<string>([
    ...resolved.map((row) => row.slotKey),
    ...lockedSlots,
  ]);

  await prisma.$transaction([
    ...resolved.map((row) =>
      prisma.bracketPick.upsert({
        where: {
          playerId_seasonId_slotKey: {
            playerId,
            seasonId,
            slotKey: row.slotKey,
          },
        },
        create: {
          playerId,
          seasonId,
          slotKey: row.slotKey,
          predictedTeamId: row.teamId,
        },
        update: { predictedTeamId: row.teamId },
      }),
    ),
    prisma.bracketPick.deleteMany({
      where: {
        playerId,
        seasonId,
        slotKey: { notIn: [...keep] },
      },
    }),
  ]);

  return { saved: resolved.length };
}

export type InternationalPickemView = {
  unlocked: boolean;
  treeLocked: boolean;
  lockLabel: string | null;
  seeds: GroupSeeds | null;
  actual: Partial<Record<BracketSlot, SlotResult>>;
  lockedSlots: BracketSlot[];
  savedPicks: Partial<Record<BracketSlot, string>>;
  slots: PickemSlotView[];
};

export async function getInternationalPickem(
  playerId?: string | null,
): Promise<InternationalPickemView> {
  const { complete, seeds } = await loadPlayoffSeeds();
  if (!complete || !seeds) {
    return {
      unlocked: false,
      treeLocked: true,
      lockLabel: "Unlocks when every group-stage match is done",
      seeds: null,
      actual: {},
      lockedSlots: [],
      savedPicks: {},
      slots: [],
    };
  }

  const now = new Date();
  const season = await getCurrentSeasonSafe();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: {
      ...publicFixtureWhere,
      slotKey: { in: [...BRACKET_SLOTS] },
    },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });
  const firstKickoff = fixtures.reduce<Date | null>((soonest, row) => {
    if (!soonest || asDate(row.scheduledAt) < asDate(soonest)) {
      return row.scheduledAt;
    }
    return soonest;
  }, null);
  const treeLockAt = fridayPredictionLockAt(firstKickoff);
  const scheduleTreeLocked = Boolean(treeLockAt && now >= treeLockAt);
  const { predictionsEnabled } = await getCupFeatureSettings();
  const treeLocked = picksClosedForOrganizer(predictionsEnabled);

  const actual: Partial<Record<BracketSlot, SlotResult>> = {};
  const lockedSlots = new Set<BracketSlot>();
  for (const fixture of fixtures) {
    if (!isBracketSlot(fixture.slotKey)) continue;
    if (fixture.status === "completed") {
      const outcome = seriesWinnerLoser(fixture);
      if (outcome) actual[fixture.slotKey] = outcome;
      lockedSlots.add(fixture.slotKey);
    } else if (treeLocked) {
      // Organizer Locked closes the tree. Unlocked stays open past kickoff
      // until the series is completed.
      lockedSlots.add(fixture.slotKey);
    }
  }

  const stored =
    playerId && season
      ? await prisma.bracketPick
          .findMany({
            where: { playerId, seasonId: season.id },
            select: { slotKey: true, predictedTeamId: true },
          })
          .catch(() => [])
      : [];
  const picks = pickMapFrom(
    stored.map((row) => ({ slotKey: row.slotKey, teamId: row.predictedTeamId })),
  );

  return {
    unlocked: true,
    treeLocked,
    lockLabel: !predictionsEnabled
      ? "Locked by organizer"
      : scheduleTreeLocked
        ? "Open (organizer reopened after Friday lock)"
        : treeLockAt
          ? `Locks ${formatScheduleWhen(treeLockAt)}`
          : "Fill the tree. Locks Friday at 10:00 PM PKT.",
    seeds,
    actual,
    lockedSlots: [...lockedSlots],
    savedPicks: picks,
    slots: pickemSlots(seeds, actual, picks, lockedSlots, treeLocked),
  };
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

  if (fixture.slotKey && isBracketSlot(fixture.slotKey) && fixture.seasonId) {
    const bracketPicks = await prisma.bracketPick.findMany({
      where: { seasonId: fixture.seasonId, slotKey: fixture.slotKey },
    });
    await Promise.all(
      bracketPicks.map((pick) =>
        prisma.bracketPick.update({
          where: { id: pick.id },
          data: {
            pointsAwarded: pick.predictedTeamId === winnerId ? points : 0,
            scoredAt,
          },
        }),
      ),
    );
  }
}

function toMatchView(
  fixture: ScheduleFixtureView,
  myPickId: string | null,
  stageLocked: boolean,
): PredictionMatchView {
  const matchLocked =
    stageLocked ||
    fixture.status === "completed";
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
): PredictionNightView[] {
  return groupScheduleByNight(fixtures).map((night) => ({
    label: night.label,
    fixtures: night.fixtures.map((fixture) =>
      toMatchView(
        fixture,
        pickByFixture.get(fixture.id) ?? null,
        stageLocked,
      ),
    ),
  }));
}

export async function getPredictionBoard(playerId?: string | null) {
  const now = new Date();
  const [{ predictionsEnabled }, all] = await Promise.all([
    getCupFeatureSettings(),
    listCupSchedule({ publicOnly: true }),
  ]);
  const group = all.filter((row) => isGroupStagePredictionFixture(row.kind));
  const international = all.filter((row) =>
    isInternationalPredictionFixture(row.kind),
  );
  const groupLockAt = groupStageLockAt(group);
  const fridayLocked = isGroupStageLocked(groupLockAt, now);
  const groupLocked = picksClosedForOrganizer(predictionsEnabled);
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

  const groupNights = nightsFor(group, pickByFixture, groupLocked);
  const internationalNights = nightsFor(
    international,
    pickByFixture,
    internationalLocked,
  );

  return {
    group: {
      nights: groupNights,
      openCount: groupLocked
        ? 0
        : groupNights.flatMap((night) => night.fixtures).length,
      stageLocked: groupLocked,
      lockLabel: !predictionsEnabled
        ? "Locked by organizer"
        : fridayLocked
          ? "Open (organizer reopened after Friday lock)"
          : groupLockAt
            ? formatScheduleWhen(groupLockAt)
            : null,
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

export async function getPredictionLeaderboard(
  youPlayerId?: string | null,
  options?: { forAdmin?: boolean },
) {
  const season = await getCurrentSeasonSafe();
  if (!season) return emptyLeaderboard;

  const seasonFilter = await currentSeasonFilter();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: { ...publicFixtureWhere, ...seasonFilter },
    select: { kind: true, status: true },
  });
  const revealed =
    options?.forAdmin === true || groupStageIsComplete(fixtures);

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

  try {
    const bracketPicks = await prisma.bracketPick.findMany({
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
    for (const pick of bracketPicks) {
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
  } catch {
    /* table may not exist until db push */
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
