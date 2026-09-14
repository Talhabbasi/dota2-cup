import { MIN_ROSTER } from "./constants";
import { matchKickoffWindow } from "./play-window";
import { prisma } from "./prisma";
import {
  FINAL_BEST_OF,
  REGULAR_BEST_OF,
  formatScheduleWhen,
  kickoffAt,
  localParts,
  parseFridayInput,
  resolveWeekendFriday,
  scheduleUtcOffsetHours,
  teamRowFromRoster,
} from "./schedule";
import {
  BRACKET_META,
  BRACKET_SLOTS,
  advanceBracket,
  isBracketSlot,
  loadPlayoffSeeds,
  maybeOpenPlayoffsFromGroups,
  seriesWinnerLoser,
  unlockedPairings,
  type BracketSlot,
} from "./playoff-bracket";
import type { GroupStandingRow } from "./group-stage-schedule";

export const PLAYOFF_TEAM_COUNT = 8;
export const PLAYOFF_GROUP_SIZE = 4;

export const PLAYOFF_KINDS = [
  "group",
  "adv",
  "ub",
  "ub_final",
  "lb",
  "lb_final",
  "final",
] as const;

export type PlayoffKind = (typeof PLAYOFF_KINDS)[number];

export const PLAYOFF_SLOTS = [
  "group-a-1",
  "group-a-2",
  "group-b-1",
  "group-b-2",
  "ub",
  "lb",
  "lb_final",
  "final",
] as const;

export type PlayoffSlot = (typeof PLAYOFF_SLOTS)[number];

const LIVE_DUMMY_PREFIX = "test-dummy";

export function isLiveCupTeam(team: { name: string; captainId: string }) {
  return (
    !team.captainId.startsWith(LIVE_DUMMY_PREFIX) &&
    !team.name.startsWith("Test ")
  );
}

export function isPlayoffKind(kind: string | null | undefined) {
  return Boolean(kind && (PLAYOFF_KINDS as readonly string[]).includes(kind));
}

export function playoffRoundLabel(
  kind: string | null | undefined,
  slotKey?: string | null,
) {
  if (isBracketSlot(slotKey)) return BRACKET_META[slotKey].label;
  switch (slotKey) {
    case "group-a-1":
      return "Group A · Match 1";
    case "group-a-2":
      return "Group A · Match 2";
    case "group-b-1":
      return "Group B · Match 1";
    case "group-b-2":
      return "Group B · Match 2";
    case "ub":
      return "Upper bracket";
    case "lb":
      return "Elimination";
    case "lb_final":
      return "Lower Final";
    case "final":
      return "Grand Final";
    default:
      break;
  }
  switch (kind) {
    case "group":
      return "Group stage";
    case "adv":
      return "Advancement Match";
    case "ub":
      return "Upper bracket";
    case "ub_final":
      return "Upper Final";
    case "lb":
      return "Lower bracket";
    case "lb_final":
      return "Lower Final";
    case "final":
      return "Grand Final";
    default:
      return "Match";
  }
}

function orientIds(a: { id: string; name: string }, b: { id: string; name: string }) {
  return a.name.localeCompare(b.name) <= 0
    ? { radiant: a, dire: b }
    : { radiant: b, dire: a };
}

function seriesWinner<T extends { radiantTeamId: string; direTeamId: string; radiantWins: number; direWins: number }>(
  fixture: T,
) {
  if (fixture.radiantWins === fixture.direWins) return null;
  return fixture.radiantWins > fixture.direWins
    ? fixture.radiantTeamId
    : fixture.direTeamId;
}

function seriesLoser<T extends { radiantTeamId: string; direTeamId: string; radiantWins: number; direWins: number }>(
  fixture: T,
) {
  const winnerId = seriesWinner(fixture);
  if (!winnerId) return null;
  return winnerId === fixture.radiantTeamId
    ? fixture.direTeamId
    : fixture.radiantTeamId;
}

async function liveTeams() {
  const teams = await prisma.team.findMany({
    include: { players: { select: { playWindow: true } } },
    orderBy: { name: "asc" },
  });
  return teams.filter(isLiveCupTeam);
}

async function requireLiveRosters() {
  const teams = await liveTeams();
  const under = teams.filter((team) => team.players.length < MIN_ROSTER);
  if (under.length > 0) {
    throw new Error(
      `These teams need at least ${MIN_ROSTER} players: ${under
        .map((team) => `**${team.name}** (${team.players.length}/${MIN_ROSTER})`)
        .join(", ")}.`,
    );
  }
  return teams;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export async function seedPlayoffGroups() {
  const teams = await requireLiveRosters();
  if (teams.length !== PLAYOFF_TEAM_COUNT) {
    throw new Error(
      `Need exactly **${PLAYOFF_TEAM_COUNT}** live teams for 2 groups. Currently **${teams.length}**.`,
    );
  }

  const shuffled = shuffle(teams);
  await prisma.$transaction(
    shuffled.map((team, index) =>
      prisma.team.update({
        where: { id: team.id },
        data: { groupKey: index < PLAYOFF_GROUP_SIZE ? "A" : "B" },
      }),
    ),
  );

  return getPlayoffView();
}

export async function assignPlayoffGroup(input: {
  teamName: string;
  group: "A" | "B";
}) {
  const name = input.teamName.trim();
  const teams = await liveTeams();
  const team = teams.find(
    (row) => row.name.toLowerCase() === name.toLowerCase(),
  );
  if (!team) {
    throw new Error(`Team "${name}" not found.`);
  }

  const already = teams.filter(
    (row) => row.groupKey === input.group && row.id !== team.id,
  );
  if (already.length >= PLAYOFF_GROUP_SIZE) {
    throw new Error(`Group ${input.group} already has ${PLAYOFF_GROUP_SIZE} teams.`);
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { groupKey: input.group },
  });

  return { teamName: team.name, group: input.group };
}

function pairGroup(teams: { id: string; name: string }[]) {
  const shuffled = shuffle(teams);
  if (shuffled.length !== PLAYOFF_GROUP_SIZE) {
    throw new Error("Each group needs exactly 4 teams.");
  }
  return {
    seed1: orientIds(shuffled[0], shuffled[1]),
    seed2: orientIds(shuffled[2], shuffled[3]),
  };
}

async function nextWeekendIndex() {
  const last = await prisma.scheduledFixture.aggregate({
    _max: { weekendIndex: true },
  });
  return (last._max.weekendIndex ?? -1) + 1;
}

async function createPlayoffFixture(input: {
  slotKey: PlayoffSlot;
  kind: PlayoffKind;
  radiantTeamId: string;
  direTeamId: string;
  weekendIndex: number;
  weekOffset: number;
  slotIndex: number;
  friday: Date;
  bestOf: number;
}) {
  const teams = await prisma.team.findMany({
    where: { id: { in: [input.radiantTeamId, input.direTeamId] } },
    include: { players: { select: { playWindow: true } } },
  });
  const radiant = teams.find((team) => team.id === input.radiantTeamId);
  const dire = teams.find((team) => team.id === input.direTeamId);
  if (!radiant || !dire) {
    throw new Error("Could not load teams for the next playoff match.");
  }

  const offsetH = scheduleUtcOffsetHours();
  const start = localParts(input.friday, offsetH);
  const window = matchKickoffWindow(
    teamRowFromRoster(radiant).playWindow,
    teamRowFromRoster(dire).playWindow,
  );

  return prisma.scheduledFixture.create({
    data: {
      radiantTeamId: input.radiantTeamId,
      direTeamId: input.direTeamId,
      scheduledAt: kickoffAt(
        start,
        input.weekOffset,
        input.slotIndex,
        window,
        offsetH,
      ),
      weekendIndex: input.weekendIndex,
      slotIndex: input.slotIndex,
      kind: input.kind,
      slotKey: input.slotKey,
      bestOf: input.bestOf,
      status: "scheduled",
    },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });
}

export async function generatePlayoffGroupStage(input?: {
  friday?: string;
  force?: boolean;
}) {
  const teams = await requireLiveRosters();
  const groupA = teams.filter((team) => team.groupKey === "A");
  const groupB = teams.filter((team) => team.groupKey === "B");
  if (groupA.length !== PLAYOFF_GROUP_SIZE || groupB.length !== PLAYOFF_GROUP_SIZE) {
    throw new Error(
      `Assign all ${PLAYOFF_TEAM_COUNT} teams first: Group A has ${groupA.length}, Group B has ${groupB.length}. Use \`/playoff groups\` or \`/playoff assign\`.`,
    );
  }

  const groupRoundRobin = await prisma.scheduledFixture.count({
    where: { kind: "group", slotKey: null },
  });
  if (groupRoundRobin > 0) {
    throw new Error(
      "The 12-match group round-robin is already booked. Finish Group A and Group B, then use `/playoff open` to start the playoff bracket. Do not run `/playoff generate`.",
    );
  }

  const pending = await prisma.scheduledFixture.findMany({
    where: {
      status: "scheduled",
      OR: [
        { kind: { in: [...PLAYOFF_KINDS] } },
        { slotKey: { not: null } },
      ],
    },
  });
  if (pending.length > 0 && !input?.force) {
    throw new Error(
      `${pending.length} playoff fixtures are already scheduled. Use \`/playoff generate force:true\` or \`/playoff clear\`.`,
    );
  }

  const offsetH = scheduleUtcOffsetHours();
  const friday = input?.friday
    ? parseFridayInput(input.friday, offsetH)
    : resolveWeekendFriday(new Date(), offsetH);
  const pairsA = pairGroup(groupA);
  const pairsB = pairGroup(groupB);
  const weekendIndex = await nextWeekendIndex();

  const rows: Array<{
    slotKey: PlayoffSlot;
    pair: ReturnType<typeof orientIds>;
    weekendIndex: number;
    weekOffset: number;
    slotIndex: number;
  }> = [
    {
      slotKey: "group-a-1",
      pair: pairsA.seed1,
      weekendIndex,
      weekOffset: 0,
      slotIndex: 0,
    },
    {
      slotKey: "group-a-2",
      pair: pairsA.seed2,
      weekendIndex,
      weekOffset: 0,
      slotIndex: 1,
    },
    {
      slotKey: "group-b-1",
      pair: pairsB.seed1,
      weekendIndex,
      weekOffset: 0,
      slotIndex: 2,
    },
    {
      slotKey: "group-b-2",
      pair: pairsB.seed2,
      weekendIndex: weekendIndex + 1,
      weekOffset: 1,
      slotIndex: 0,
    },
  ];

  await prisma.$transaction(async (tx) => {
    if (input?.force) {
      await tx.scheduledFixture.deleteMany({
        where: {
          status: "scheduled",
          OR: [
            { kind: { in: [...PLAYOFF_KINDS] } },
            { slotKey: { not: null } },
          ],
        },
      });
    }
    for (const row of rows) {
      const existing = await tx.scheduledFixture.findUnique({
        where: { slotKey: row.slotKey },
      });
      if (existing) {
        if (existing.status === "completed" && !input?.force) {
          throw new Error(
            `${playoffRoundLabel("group", row.slotKey)} is already completed.`,
          );
        }
        await tx.scheduledFixture.delete({ where: { id: existing.id } });
      }
    }
  });

  const created = [];
  for (const row of rows) {
    created.push(
      await createPlayoffFixture({
        slotKey: row.slotKey,
        kind: "group",
        radiantTeamId: row.pair.radiant.id,
        direTeamId: row.pair.dire.id,
        weekendIndex: row.weekendIndex,
        weekOffset: row.weekOffset,
        slotIndex: row.slotIndex,
        friday,
        bestOf: REGULAR_BEST_OF,
      }),
    );
  }

  return { friday, fixtures: created };
}

export async function clearPlayoffFixtures() {
  const removed = await prisma.scheduledFixture.deleteMany({
    where: {
      status: "scheduled",
      OR: [
        { slotKey: { in: [...BRACKET_SLOTS] } },
        { kind: { in: ["adv", "ub", "ub_final", "lb", "lb_final", "final"] } },
        { slotKey: { in: ["ub", "lb", "lb_final", "final"] } },
      ],
    },
  });
  return removed.count;
}

async function fixtureBySlot(slotKey: PlayoffSlot) {
  return prisma.scheduledFixture.findUnique({
    where: { slotKey },
  });
}

async function ensureSlot(input: {
  slotKey: PlayoffSlot;
  kind: PlayoffKind;
  teamAId: string;
  teamBId: string;
  bestOf: number;
  slotIndex: number;
}) {
  const existing = await fixtureBySlot(input.slotKey);
  if (existing) return existing;

  const oriented = await prisma.team.findMany({
    where: { id: { in: [input.teamAId, input.teamBId] } },
    select: { id: true, name: true },
  });
  const teamA = oriented.find((team) => team.id === input.teamAId);
  const teamB = oriented.find((team) => team.id === input.teamBId);
  if (!teamA || !teamB) return null;

  const sides = orientIds(teamA, teamB);
  const friday = resolveWeekendFriday(new Date());
  return createPlayoffFixture({
    slotKey: input.slotKey,
    kind: input.kind,
    radiantTeamId: sides.radiant.id,
    direTeamId: sides.dire.id,
    weekendIndex: await nextWeekendIndex(),
    weekOffset: 0,
    slotIndex: input.slotIndex,
    friday,
    bestOf: input.bestOf,
  });
}

export async function advancePlayoff(fixtureId: string) {
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id: fixtureId },
  });
  if (!fixture || fixture.status !== "completed") return;

  if (fixture.kind === "group" || !fixture.slotKey) {
    await maybeOpenPlayoffsFromGroups();
  }

  if (isBracketSlot(fixture.slotKey)) {
    await advanceBracket();
    return;
  }

  if (!fixture.slotKey) return;

  const winnerId = seriesWinner(fixture);
  const loserId = seriesLoser(fixture);
  if (!winnerId || !loserId) return;

  if (fixture.slotKey === "group-a-1" || fixture.slotKey === "group-b-1") {
    const a1 = await fixtureBySlot("group-a-1");
    const b1 = await fixtureBySlot("group-b-1");
    if (a1?.status === "completed" && b1?.status === "completed") {
      const aWinner = seriesWinner(a1);
      const bWinner = seriesWinner(b1);
      if (aWinner && bWinner) {
        await ensureSlot({
          slotKey: "ub",
          kind: "ub",
          teamAId: aWinner,
          teamBId: bWinner,
          bestOf: REGULAR_BEST_OF,
          slotIndex: 0,
        });
      }
    }
  }

  if (fixture.slotKey === "group-a-2" || fixture.slotKey === "group-b-2") {
    const a2 = await fixtureBySlot("group-a-2");
    const b2 = await fixtureBySlot("group-b-2");
    if (a2?.status === "completed" && b2?.status === "completed") {
      const aWinner = seriesWinner(a2);
      const bWinner = seriesWinner(b2);
      if (aWinner && bWinner) {
        await ensureSlot({
          slotKey: "lb",
          kind: "lb",
          teamAId: aWinner,
          teamBId: bWinner,
          bestOf: REGULAR_BEST_OF,
          slotIndex: 1,
        });
      }
    }
  }

  if (fixture.slotKey === "ub" || fixture.slotKey === "lb") {
    const ub = await fixtureBySlot("ub");
    const lb = await fixtureBySlot("lb");
    if (ub?.status === "completed" && lb?.status === "completed") {
      const ubLoser = seriesLoser(ub);
      const lbWinner = seriesWinner(lb);
      if (ubLoser && lbWinner) {
        await ensureSlot({
          slotKey: "lb_final",
          kind: "lb_final",
          teamAId: ubLoser,
          teamBId: lbWinner,
          bestOf: REGULAR_BEST_OF,
          slotIndex: 2,
        });
      }
    }
  }

  if (fixture.slotKey === "lb_final") {
    const ub = await fixtureBySlot("ub");
    const lbFinal = await fixtureBySlot("lb_final");
    if (ub?.status === "completed" && lbFinal?.status === "completed") {
      const ubWinner = seriesWinner(ub);
      const finalist = seriesWinner(lbFinal);
      if (ubWinner && finalist) {
        await ensureSlot({
          slotKey: "final",
          kind: "final",
          teamAId: ubWinner,
          teamBId: finalist,
          bestOf: FINAL_BEST_OF,
          slotIndex: 0,
        });
      }
    }
  }
}

export type PlayoffMatchView = {
  slotKey: BracketSlot;
  kind: string;
  label: string;
  round: string;
  stage: "advancement" | "upper" | "lower" | "grand";
  matchNumber: number | null;
  status: "empty" | "scheduled" | "completed";
  displayStatus: "waiting" | "upcoming" | "live" | "completed";
  bestOf: number;
  formatLabel: string;
  radiant: { id: string; name: string } | null;
  dire: { id: string; name: string } | null;
  winner: { id: string; name: string } | null;
  loser: { id: string; name: string } | null;
  scheduledAt: Date | null;
  radiantWins: number;
  direWins: number;
  waitingReason: string | null;
  winnerGoes: string;
  loserGoes: string;
  leftLabel: string;
  rightLabel: string;
};

export type PlayoffView = {
  groupA: { id: string; name: string }[];
  groupB: { id: string; name: string }[];
  unassigned: { id: string; name: string }[];
  standingsA: GroupStandingRow[];
  standingsB: GroupStandingRow[];
  matches: PlayoffMatchView[];
  groupRoundRobin: number;
  groupStageComplete: boolean;
  eliminated: { id: string; name: string }[];
};

function displayStatusFor(
  status: PlayoffMatchView["status"],
  scheduledAt: Date | null,
  bestOf: number,
  now: Date,
): PlayoffMatchView["displayStatus"] {
  if (status === "completed") return "completed";
  if (status === "empty" || !scheduledAt) return "waiting";
  const durationMs = (bestOf >= 3 ? 4 : 2) * 60 * 60 * 1000;
  if (now.getTime() >= scheduledAt.getTime() && now.getTime() < scheduledAt.getTime() + durationMs) {
    return "live";
  }
  return "upcoming";
}

function matchViewFromSlot(
  slotKey: BracketSlot,
  fixture:
    | {
        kind: string;
        status: string;
        bestOf: number;
        scheduledAt: Date;
        radiantWins: number;
        direWins: number;
        radiantTeamId: string;
        direTeamId: string;
        radiantTeam: { id: string; name: string };
        direTeam: { id: string; name: string };
      }
    | undefined,
  pairing: { left: { id: string; name: string } | null; right: { id: string; name: string } | null },
  now: Date,
): PlayoffMatchView {
  const meta = BRACKET_META[slotKey];
  const radiant = fixture?.radiantTeam ?? pairing.left;
  const dire = fixture?.direTeam ?? pairing.right;
  const status: PlayoffMatchView["status"] = fixture
    ? fixture.status === "completed"
      ? "completed"
      : "scheduled"
    : "empty";
  const outcome = fixture && fixture.status === "completed"
    ? seriesWinnerLoser({
        radiantTeamId: fixture.radiantTeam.id,
        direTeamId: fixture.direTeam.id,
        radiantWins: fixture.radiantWins,
        direWins: fixture.direWins,
        radiantTeam: fixture.radiantTeam,
        direTeam: fixture.direTeam,
      })
    : null;
  const ready = Boolean(radiant && dire);
  return {
    slotKey,
    kind: fixture?.kind ?? meta.kind,
    label: meta.label,
    round: meta.round,
    stage: meta.stage,
    matchNumber: meta.matchNumber,
    status,
    displayStatus: displayStatusFor(status, fixture?.scheduledAt ?? null, fixture?.bestOf ?? meta.bestOf, now),
    bestOf: fixture?.bestOf ?? meta.bestOf,
    formatLabel: (fixture?.bestOf ?? meta.bestOf) >= 3 ? "Bo3" : "Bo1",
    radiant,
    dire,
    winner: outcome?.winner ?? null,
    loser: outcome?.loser ?? null,
    scheduledAt: fixture?.scheduledAt ?? null,
    radiantWins: fixture?.radiantWins ?? 0,
    direWins: fixture?.direWins ?? 0,
    waitingReason:
      status === "empty"
        ? ready
          ? "Ready once the previous results are locked in"
          : meta.waiting
        : null,
    winnerGoes: meta.winnerGoes,
    loserGoes: meta.loserGoes,
    leftLabel: meta.leftLabel,
    rightLabel: meta.rightLabel,
  };
}

export async function getPlayoffView(): Promise<PlayoffView> {
  const teams = await liveTeams();
  const { groupA: standingsA, groupB: standingsB, complete, seeds } = await loadPlayoffSeeds();
  const now = new Date();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: {
      OR: [
        { kind: { in: [...PLAYOFF_KINDS] } },
        { slotKey: { in: [...PLAYOFF_SLOTS, ...BRACKET_SLOTS] } },
      ],
    },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });
  const bySlot = new Map(
    fixtures.filter((row) => row.slotKey).map((row) => [row.slotKey as string, row]),
  );
  const results: Partial<
    Record<BracketSlot, { winner: { id: string; name: string }; loser: { id: string; name: string } }>
  > = {};
  for (const slot of BRACKET_SLOTS) {
    const fixture = bySlot.get(slot);
    if (!fixture || fixture.status !== "completed") continue;
    const outcome = seriesWinnerLoser(fixture);
    if (outcome) results[slot] = outcome;
  }
  const pairings = unlockedPairings(seeds, results);
  const matches = BRACKET_SLOTS.map((slotKey) =>
    matchViewFromSlot(slotKey, bySlot.get(slotKey), pairings[slotKey], now),
  );

  return {
    groupA: teams
      .filter((team) => team.groupKey === "A")
      .map((team) => ({ id: team.id, name: team.name })),
    groupB: teams
      .filter((team) => team.groupKey === "B")
      .map((team) => ({ id: team.id, name: team.name })),
    unassigned: teams
      .filter((team) => team.groupKey !== "A" && team.groupKey !== "B")
      .map((team) => ({ id: team.id, name: team.name })),
    matches,
    groupRoundRobin: fixtures.filter((row) => row.kind === "group").length,
    groupStageComplete: complete,
    standingsA,
    standingsB,
    eliminated: complete && standingsA[3] && standingsB[3]
      ? [
          { id: standingsA[3].id, name: standingsA[3].name },
          { id: standingsB[3].id, name: standingsB[3].name },
        ]
      : [],
  };
}

export async function openPlayoffsFromGroups() {
  const { complete } = await loadPlayoffSeeds();
  if (!complete) {
    throw new Error(
      "Finish every Group A and Group B match first. 4th place is then eliminated and the Advancement Match (A3 vs B3) plus Upper Round 1 are booked automatically.",
    );
  }
  const opened = await maybeOpenPlayoffsFromGroups();
  const advanced = await advanceBracket();
  return {
    opened: opened.opened,
    created: [...opened.created, ...advanced.created],
  };
}

export function playoffMatchesReady(view: PlayoffView) {
  return (
    view.groupRoundRobin > 0 ||
    view.groupStageComplete ||
    view.matches.some((match) => match.status !== "empty")
  );
}

export function formatPlayoffGroups(view: PlayoffView) {
  const lines = [
    "**MM Dota Cup — Group stage**",
    "8 teams, 2 groups of 4. Single round-robin, Bo1.",
    "",
    "**Group A**",
    view.groupA.length
      ? view.groupA.map((team) => `• ${team.name}`).join("\n")
      : "• not assigned",
    "",
    "**Group B**",
    view.groupB.length
      ? view.groupB.map((team) => `• ${team.name}`).join("\n")
      : "• not assigned",
  ];
  if (view.unassigned.length > 0) {
    lines.push(
      "",
      "**Unassigned**",
      view.unassigned.map((team) => `• ${team.name}`).join("\n"),
    );
  }
  return lines.join("\n").trim();
}

function formatMatchLine(match: PlayoffMatchView) {
  const left = match.radiant?.name ?? match.leftLabel;
  const right = match.dire?.name ?? match.rightLabel;
  const format = match.formatLabel;
  let state = match.waitingReason ?? "Waiting";
  if (match.displayStatus === "upcoming" && match.scheduledAt) {
    state = `Upcoming · ${formatScheduleWhen(match.scheduledAt)}`;
  } else if (match.displayStatus === "live" && match.scheduledAt) {
    state = `Live · ${formatScheduleWhen(match.scheduledAt)}`;
  } else if (match.displayStatus === "completed" && match.winner) {
    state = `Completed · ${match.winner.name} won`;
    if (match.loser && match.loserGoes === "Eliminated") {
      state += ` · ${match.loser.name} eliminated`;
    }
  } else if (match.scheduledAt) {
    state = formatScheduleWhen(match.scheduledAt);
  }
  const score =
    match.bestOf > 1 || match.status === "completed"
      ? ` ${match.radiantWins}–${match.direWins}`
      : "";
  return `• **${match.label}** (${format}${score}) — **${left}** vs **${right}** · ${state}`;
}

export function formatPlayoffStatus(view: PlayoffView) {
  const lines = [formatPlayoffGroups(view)];

  if (view.groupStageComplete && view.standingsA.length && view.standingsB.length) {
    const rank = (rows: GroupStandingRow[]) =>
      rows
        .map((row, index) => {
          const tag = index === 3 ? " — Eliminated" : "";
          return `${index + 1}. ${row.name}${tag}`;
        })
        .join("\n");
    lines.push(
      "",
      "**Final Group A standings**",
      rank(view.standingsA),
      "",
      "**Final Group B standings**",
      rank(view.standingsB),
      "",
      `**Eliminated:** ${view.eliminated.map((team) => team.name).join(", ")}`,
    );
  }

  if (!playoffMatchesReady(view) && !view.groupStageComplete) {
    return lines.join("\n").trim();
  }

  lines.push("", formatPlayoffGraph(view));

  const byStage = {
    advancement: view.matches.filter((match) => match.stage === "advancement"),
    upper: view.matches.filter((match) => match.stage === "upper"),
    lower: view.matches.filter((match) => match.stage === "lower"),
    grand: view.matches.filter((match) => match.stage === "grand"),
  };

  lines.push("", "**Advancement Match** (Bo1 · winner to playoffs, loser eliminated)");
  for (const match of byStage.advancement) lines.push(formatMatchLine(match));
  lines.push("", "**Upper Bracket**");
  for (const match of byStage.upper) lines.push(formatMatchLine(match));
  lines.push("", "**Lower Bracket**");
  for (const match of byStage.lower) lines.push(formatMatchLine(match));
  lines.push("", "**Grand Final** (Bo3)");
  for (const match of byStage.grand) lines.push(formatMatchLine(match));

  return lines.join("\n").trim();
}

export function formatPlayoffGraph(view: PlayoffView) {
  const label = (slot: BracketSlot) => {
    const match = view.matches.find((row) => row.slotKey === slot);
    if (!match) return slot;
    const left = match.radiant?.name ?? match.leftLabel;
    const right = match.dire?.name ?? match.rightLabel;
    const code = match.matchNumber != null ? `M${match.matchNumber}` : "Adv";
    const state =
      match.displayStatus === "completed" && match.winner
        ? ` · ${match.winner.name} won`
        : match.displayStatus === "live"
          ? " · Live"
          : match.displayStatus === "upcoming"
            ? " · Upcoming"
            : "";
    return `${code} ${left} vs ${right}${state}`;
  };
  return [
    "**Bracket graph** (winners move right, losers drop to Lower)",
    "```",
    `Upper  ${label("ub1")}`,
    "           └─► Upper Final ─► Grand Final Bo3",
    `       ${label("ub2")}`,
    `Lower  ${label("adv")} ─► ${label("lb1")} ─► ${label("lb2")} ─► ${label("lb_final")} ─► Grand Final`,
    "```",
    `Upper Final: ${label("uf")}`,
    `Grand Final: ${label("final")}`,
  ].join("\n");
}
