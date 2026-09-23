import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { publicTeamWhere } from "./dummy";
import { formatScheduleWhen, scheduleUtcOffsetHours } from "./schedule";
import { currentSeasonFilter } from "./seasons";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import {
  createScheduledMatch,
  upcomingWeekendDates,
} from "./schedule-crud";

function cupSiteUrl() {
  return (process.env.NEXTAUTH_URL || "https://dota2-cup.vercel.app").replace(
    /\/+$/,
    "",
  );
}

const GROUP_A_HOURS = ["22", "23", "0", "2", "3", "4"] as const;
const GROUP_B_HOURS = ["22", "23", "0", "1", "2", "3"] as const;

const GROUP_A_MATCHES = [
  ["Team Chessman", "Team Lala"],
  ["Team XTC", "Team Yona"],
  ["Team Chessman", "Team XTC"],
  ["Team Chessman", "Team Yona"],
  ["Team Lala", "Team XTC"],
  ["Team Lala", "Team Yona"],
] as const;

const GROUP_B_MATCHES = [
  ["Team Ash", "Team Grand_Master"],
  ["Team Saif", "Team Stoic"],
  ["Team Ash", "Team Saif"],
  ["Team Grand_Master", "Team Stoic"],
  ["Team Ash", "Team Stoic"],
  ["Team Grand_Master", "Team Saif"],
] as const;

function matchNightYmd(date: Date) {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(date.getTime() + offsetH * 3_600_000);
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

  const pending = await prisma.scheduledFixture.count({
    where: { status: "scheduled", kind: "group" },
  });
  if (pending > 0 && !input?.force) {
    throw new Error(
      `${pending} group matches are already booked. Pass force:true to replace them, or \`/schedule edit\` to change one.`,
    );
  }
  if (input?.force) {
    await prisma.scheduledFixture.deleteMany({
      where: { status: "scheduled", kind: "group" },
    });
  }

  const booked: BookedGroupMatch[] = [];

  for (let i = 0; i < GROUP_A_MATCHES.length; i++) {
    const [teamA, teamB] = GROUP_A_MATCHES[i];
    const fixture = await createScheduledMatch({
      teamA,
      teamB,
      date: saturday,
      time: GROUP_A_HOURS[i],
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

  for (let i = 0; i < GROUP_B_MATCHES.length; i++) {
    const [teamA, teamB] = GROUP_B_MATCHES[i];
    const fixture = await createScheduledMatch({
      teamA,
      teamB,
      date: sunday,
      time: GROUP_B_HOURS[i],
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

function groupStandingsFinished(rows: GroupStandingRow[]) {
  return rows.length === 4 && rows.every((row) => row.played === 3);
}

export async function groupStageComplete() {
  const [groupA, groupB] = await Promise.all([
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  return groupStandingsFinished(groupA) && groupStandingsFinished(groupB);
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
  const site = cupSiteUrl();
  return [
    formatDayBlock(`**DAY 1 — SATURDAY ${result.saturday} — GROUP A**`, groupA),
    "",
    formatDayBlock(`**DAY 2 — SUNDAY ${result.sunday} — GROUP B**`, groupB),
    "",
    `Also on the website: **${site}/schedule**`,
    "",
    "**10pm–12am window:** Prodandy (Chessman), INVOKER (Ash), and Dendi The Main Culprit (Saif) each get **2 of 3** group games in that window. Their third game is 2:00 AM or 3:00 AM so nobody plays back-to-back and both groups still finish the same night.",
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
