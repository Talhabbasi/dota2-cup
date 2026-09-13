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

export const PLAYOFF_TEAM_COUNT = 8;
export const PLAYOFF_GROUP_SIZE = 4;

export const PLAYOFF_KINDS = [
  "group",
  "ub",
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
      return "Elimination final";
    case "final":
      return "Grand Final";
    default:
      break;
  }
  switch (kind) {
    case "group":
      return "Group stage";
    case "ub":
      return "Upper bracket";
    case "lb":
      return "Elimination";
    case "lb_final":
      return "Elimination final";
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
        { kind: { in: ["group", "ub", "lb", "lb_final"] } },
        { slotKey: { in: [...PLAYOFF_SLOTS] } },
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
  if (!fixture || fixture.status !== "completed" || !fixture.slotKey) return;

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
  slotKey: PlayoffSlot;
  kind: string;
  label: string;
  status: "empty" | "scheduled" | "completed";
  bestOf: number;
  radiant: { id: string; name: string } | null;
  dire: { id: string; name: string } | null;
  winner: { id: string; name: string } | null;
  scheduledAt: Date | null;
  radiantWins: number;
  direWins: number;
};

export type PlayoffView = {
  groupA: { id: string; name: string }[];
  groupB: { id: string; name: string }[];
  unassigned: { id: string; name: string }[];
  matches: PlayoffMatchView[];
};

function emptyMatch(slotKey: PlayoffSlot, kind: PlayoffKind): PlayoffMatchView {
  return {
    slotKey,
    kind,
    label: playoffRoundLabel(kind, slotKey),
    status: "empty",
    bestOf: slotKey === "final" ? FINAL_BEST_OF : REGULAR_BEST_OF,
    radiant: null,
    dire: null,
    winner: null,
    scheduledAt: null,
    radiantWins: 0,
    direWins: 0,
  };
}

export async function getPlayoffView(): Promise<PlayoffView> {
  const teams = await liveTeams();
  const fixtures = await prisma.scheduledFixture.findMany({
    where: {
      OR: [
        { kind: { in: [...PLAYOFF_KINDS] } },
        { slotKey: { in: [...PLAYOFF_SLOTS] } },
      ],
    },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });
  const bySlot = new Map(fixtures.filter((row) => row.slotKey).map((row) => [row.slotKey, row]));

  const matches = PLAYOFF_SLOTS.map((slotKey) => {
    const kind: PlayoffKind =
      slotKey.startsWith("group")
        ? "group"
        : slotKey === "lb_final"
          ? "lb_final"
          : (slotKey as PlayoffKind);
    const fixture = bySlot.get(slotKey);
    if (!fixture) return emptyMatch(slotKey, kind);
    const winnerId = fixture.status === "completed" ? seriesWinner(fixture) : null;
    const winner =
      winnerId === fixture.radiantTeamId
        ? fixture.radiantTeam
        : winnerId === fixture.direTeamId
          ? fixture.direTeam
          : null;
    return {
      slotKey,
      kind: fixture.kind,
      label: playoffRoundLabel(fixture.kind, slotKey),
      status: fixture.status === "completed" ? "completed" : "scheduled",
      bestOf: fixture.bestOf,
      radiant: fixture.radiantTeam,
      dire: fixture.direTeam,
      winner,
      scheduledAt: fixture.scheduledAt,
      radiantWins: fixture.radiantWins,
      direWins: fixture.direWins,
    } satisfies PlayoffMatchView;
  });

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
  };
}

export function playoffMatchesReady(view: PlayoffView) {
  return view.matches.some((match) => match.status !== "empty");
}

export function formatPlayoffGroups(view: PlayoffView) {
  const lines = [
    "**MM Dota Cup — Group stage**",
    "8 teams, 2 groups of 4. Matches will be posted later.",
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

export function formatPlayoffStatus(view: PlayoffView) {
  if (!playoffMatchesReady(view)) {
    return formatPlayoffGroups(view);
  }

  const lines = [formatPlayoffGroups(view), "", "**Bracket**"];
  for (const match of view.matches) {
    if (match.status === "empty") continue;
    const left = match.radiant?.name ?? "TBD";
    const right = match.dire?.name ?? "TBD";
    const series =
      match.bestOf > 1 ? ` · BO${match.bestOf} ${match.radiantWins}–${match.direWins}` : "";
    let state = "not scheduled";
    if (match.status === "scheduled" && match.scheduledAt) {
      state = formatScheduleWhen(match.scheduledAt);
    } else if (match.status === "completed" && match.winner) {
      state = `${match.winner.name} won`;
    }
    lines.push(`• **${match.label}** — **${left}** vs **${right}**${series} · ${state}`);
  }
  return lines.join("\n").trim();
}
