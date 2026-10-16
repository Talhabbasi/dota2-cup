import { unstable_cache } from "next/cache";
import { cupPublicUrl } from "./brand";
import { prisma } from "./prisma";
import { publicTeamWhere } from "./dummy";
import { formatScheduleWhen, scheduleUtcOffsetHours, asDate } from "./schedule";
import { currentSeasonFilter } from "./seasons";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import {
  createScheduledMatch,
  upcomingWeekendDates,
} from "./schedule-crud";
import { getLivePlayoffFormat, roundRobinPairs } from "./playoff-format";

/** Kickoff hours PKT starting 22:00, one match per hour (wraps past midnight). */
function hoursForMatchCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String((22 + i) % 24));
}

function matchNightYmd(date: Date | string) {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(asDate(date).getTime() + offsetH * 3_600_000);
  let year = shifted.getUTCFullYear();
  let month = shifted.getUTCMonth();
  let day = shifted.getUTCDate();
  if (shifted.getUTCHours() < 12) {
    const prev = new Date(Date.UTC(year, month, day - 1));
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth();
    day = prev.getUTCDate();
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type GroupStandingRow = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

export type BookedGroupMatch = {
  group: "A" | "B";
  matchNumber: number;
  teamA: string;
  teamB: string;
  scheduledAt: Date;
};

function defaultGroupDates() {
  const dates = upcomingWeekendDates(8);
  const saturday = dates.find((row) => row.name.startsWith("Saturday"));
  const sunday = dates.find((row) => row.name.startsWith("Sunday"));
  if (!saturday || !sunday) {
    throw new Error("Could not find the next Saturday and Sunday.");
  }
  return { saturday: saturday.value, sunday: sunday.value };
}

export async function bookGroupStageRoundRobin(input?: {
  saturday?: string;
  sunday?: string;
  force?: boolean;
}) {
  const dates = defaultGroupDates();
  const saturday = input?.saturday?.trim() || dates.saturday;
  const sunday = input?.sunday?.trim() || dates.sunday;
  const [format, season] = await Promise.all([
    getLivePlayoffFormat(),
    currentSeasonFilter(),
  ]);

  const teams = await prisma.team.findMany({
    where: { ...publicTeamWhere, ...season },
    select: { name: true, groupKey: true },
    orderBy: { name: "asc" },
  });
  const groupA = teams.filter((t) => t.groupKey === "A").map((t) => t.name);
  const groupB = teams.filter((t) => t.groupKey === "B").map((t) => t.name);
  if (groupA.length !== format.groupSize || groupB.length !== format.groupSize) {
    throw new Error(
      `Assign all ${format.teamCount} teams first (Group A ${groupA.length}/${format.groupSize}, Group B ${groupB.length}/${format.groupSize}). Use Admin → Playoffs or \`/playoff groups\`.`,
    );
  }

  const pairsA = roundRobinPairs(groupA);
  const pairsB = roundRobinPairs(groupB);
  const hoursA = hoursForMatchCount(pairsA.length);
  const hoursB = hoursForMatchCount(pairsB.length);

  const pending = await prisma.scheduledFixture.count({
    where: { status: "scheduled", kind: "group", ...season },
  });
  if (pending > 0 && !input?.force) {
    throw new Error(
      `${pending} group matches are already booked. Pass force to replace them, or edit a single fixture.`,
    );
  }
  if (input?.force) {
    await prisma.scheduledFixture.deleteMany({
      where: { status: "scheduled", kind: "group", ...season },
    });
  }

  const booked: BookedGroupMatch[] = [];

  for (let i = 0; i < pairsA.length; i++) {
    const [teamA, teamB] = pairsA[i];
    const fixture = await createScheduledMatch({
      teamA,
      teamB,
      date: saturday,
      time: hoursA[i],
      kind: "group",
    });
    booked.push({
      group: "A",
      matchNumber: i + 1,
      teamA: fixture.radiantTeam.name,
      teamB: fixture.direTeam.name,
      scheduledAt: fixture.scheduledAt,
    });
  }

  for (let i = 0; i < pairsB.length; i++) {
    const [teamA, teamB] = pairsB[i];
    const fixture = await createScheduledMatch({
      teamA,
      teamB,
      date: sunday,
      time: hoursB[i],
      kind: "group",
    });
    booked.push({
      group: "B",
      matchNumber: i + 1,
      teamA: fixture.radiantTeam.name,
      teamB: fixture.direTeam.name,
      scheduledAt: fixture.scheduledAt,
    });
  }

  return { saturday, sunday, fixtures: booked };
}

export const getGroupStandings = unstable_cache(
  async (groupKey: "A" | "B"): Promise<GroupStandingRow[]> => {
    const season = await currentSeasonFilter();
    const [teams, fixtures] = await Promise.all([
      prisma.team.findMany({
        where: { groupKey, ...publicTeamWhere, ...season },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.scheduledFixture.findMany({
        where: { kind: "group", status: "completed", ...season },
        include: { match: true },
      }),
    ]);
    const ids = new Set(teams.map((team) => team.id));
    const rows = new Map<string, GroupStandingRow>(
      teams.map((team) => [
        team.id,
        { id: team.id, name: team.name, played: 0, wins: 0, losses: 0, points: 0 },
      ]),
    );

    for (const fixture of fixtures) {
      if (!ids.has(fixture.radiantTeamId) || !ids.has(fixture.direTeamId)) continue;
      const radiant = rows.get(fixture.radiantTeamId);
      const dire = rows.get(fixture.direTeamId);
      if (!radiant || !dire) continue;

      let winnerId: string | null = null;
      if (fixture.radiantWins > fixture.direWins) winnerId = fixture.radiantTeamId;
      else if (fixture.direWins > fixture.radiantWins) winnerId = fixture.direTeamId;
      else if (fixture.match?.winnerTeamId) winnerId = fixture.match.winnerTeamId;
      if (!winnerId) continue;

      radiant.played += 1;
      dire.played += 1;
      if (winnerId === radiant.id) {
        radiant.wins += 1;
        radiant.points += 1;
        dire.losses += 1;
      } else if (winnerId === dire.id) {
        dire.wins += 1;
        dire.points += 1;
        radiant.losses += 1;
      }
    }

    return [...rows.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
  },
  ["group-standings"],
  { tags: [PUBLIC_PAGE_TAG], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

export async function groupStageComplete() {
  const [format, groupA, groupB] = await Promise.all([
    getLivePlayoffFormat(),
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  return (
    groupA.length === format.groupSize &&
    groupB.length === format.groupSize &&
    groupA.every((row) => row.played === format.gamesPerTeam) &&
    groupB.every((row) => row.played === format.gamesPerTeam)
  );
}

function formatDayBlock(title: string, matches: BookedGroupMatch[]) {
  const lines = [title, ""];
  for (const match of matches) {
    lines.push(
      `Match ${match.matchNumber} — **${match.teamA}** vs **${match.teamB}** — ${formatScheduleWhen(match.scheduledAt)} — Bo1`,
    );
  }
  return lines.join("\n");
}

export function formatGroupStageDiscord(result: {
  saturday: string;
  sunday: string;
  fixtures: BookedGroupMatch[];
}) {
  const groupA = result.fixtures.filter((row) => row.group === "A");
  const groupB = result.fixtures.filter((row) => row.group === "B");
  const site = cupPublicUrl();
  return [
    formatDayBlock(`**DAY 1 — SATURDAY ${result.saturday} — GROUP A**`, groupA),
    "",
    formatDayBlock(`**DAY 2 — SUNDAY ${result.sunday} — GROUP B**`, groupB),
    "",
    `Also on the website: **${site}/schedule**`,
  ].join("\n");
}

export async function bookedGroupStageFromDb() {
  const fixtures = await prisma.scheduledFixture.findMany({
    where: { kind: "group" },
    include: {
      radiantTeam: { select: { name: true, groupKey: true } },
      direTeam: { select: { name: true, groupKey: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (fixtures.length === 0) return null;

  const mapped: BookedGroupMatch[] = fixtures.map((fixture, index) => {
    const group: "A" | "B" =
      fixture.radiantTeam.groupKey === "B" || fixture.direTeam.groupKey === "B"
        ? "B"
        : "A";
    const sameGroup = fixtures.filter((row) => {
      const g =
        row.radiantTeam.groupKey === "B" || row.direTeam.groupKey === "B"
          ? "B"
          : "A";
      return g === group;
    });
    const matchNumber =
      sameGroup.findIndex((row) => row.id === fixture.id) + 1 || index + 1;
    return {
      group,
      matchNumber,
      teamA: fixture.radiantTeam.name,
      teamB: fixture.direTeam.name,
      scheduledAt: fixture.scheduledAt,
    };
  });

  const groupA = mapped.filter((row) => row.group === "A");
  const groupB = mapped.filter((row) => row.group === "B");
  const saturday = groupA[0] ? matchNightYmd(groupA[0].scheduledAt) : "";
  const sunday = groupB[0] ? matchNightYmd(groupB[0].scheduledAt) : "";

  return { saturday, sunday, fixtures: mapped };
}
