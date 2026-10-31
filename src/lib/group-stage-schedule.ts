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
import { getLivePlayoffFormat, roundRobinRounds } from "./playoff-format";
import { groupFixtureWinnerId } from "./season-data";

/** One group round per hour, 10:00 PM through 6:00 AM PKT. */
const GROUP_NIGHT_HOURS = ["22", "23", "0", "1", "2", "3", "4", "5", "6"];

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
  /** 1-based. Group A and Group B matches in the same round share a kickoff. */
  round: number;
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

  const roundsA = roundRobinRounds(groupA);
  const roundsB = roundRobinRounds(groupB);
  assertFullRoundRobin(groupA, roundsA, "Group A");
  assertFullRoundRobin(groupB, roundsB, "Group B");
  const roundCount = Math.max(roundsA.length, roundsB.length);
  const slots = kickoffSlots(saturday, sunday, roundCount);

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

  const planned: {
    group: "A" | "B";
    round: number;
    matchNumber: number;
    teamA: string;
    teamB: string;
    date: string;
    hour: string;
  }[] = [];
  const numbers = { A: 0, B: 0 };
  for (let round = 0; round < roundCount; round++) {
    const slot = slots[round];
    if (!slot) throw new Error("Missing a kickoff slot for this group round.");
    for (const group of ["A", "B"] as const) {
      const pairs = group === "A" ? roundsA[round] : roundsB[round];
      for (const [teamA, teamB] of pairs ?? []) {
        numbers[group] += 1;
        planned.push({
          group,
          round: round + 1,
          matchNumber: numbers[group],
          teamA,
          teamB,
          date: slot.date,
          hour: slot.hour,
        });
      }
    }
  }

  const booked: BookedGroupMatch[] = [];
  const createdIds: string[] = [];
  try {
    for (const row of planned) {
      const fixture = await createScheduledMatch({
        teamA: row.teamA,
        teamB: row.teamB,
        date: row.date,
        time: row.hour,
        kind: "group",
      });
      createdIds.push(fixture.id);
      booked.push({
        group: row.group,
        matchNumber: row.matchNumber,
        round: row.round,
        teamA: fixture.radiantTeam.name,
        teamB: fixture.direTeam.name,
        scheduledAt: fixture.scheduledAt,
      });
    }
  } catch (error) {
    if (createdIds.length > 0) {
      await prisma.scheduledFixture.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    throw error;
  }

  const nights = [
    ...new Set(booked.map((match) => matchNightYmd(match.scheduledAt))),
  ];
  return {
    saturday: nights[0] ?? saturday,
    sunday: nights[1] ?? sunday,
    fixtures: booked,
  };
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Saturday first, then Sunday, then the following weekends, 9 rounds per night. */
function kickoffSlots(saturday: string, sunday: string, roundCount: number) {
  const slots: { date: string; hour: string }[] = [];
  for (let week = 0; slots.length < roundCount; week++) {
    if (week > 6) {
      throw new Error("Not enough weekend nights to fit every group round.");
    }
    for (const date of [
      addDaysYmd(saturday, week * 7),
      addDaysYmd(sunday, week * 7),
    ]) {
      for (const hour of GROUP_NIGHT_HOURS) {
        slots.push({ date, hour });
        if (slots.length >= roundCount) return slots;
      }
    }
  }
  return slots;
}

function assertFullRoundRobin(
  names: string[],
  rounds: [string, string][][],
  label: string,
) {
  const expected = (names.length * (names.length - 1)) / 2;
  const seen = new Set<string>();
  const games = new Map(names.map((name) => [name, 0]));
  for (const round of rounds) {
    const playing = new Set<string>();
    for (const [a, b] of round) {
      if (playing.has(a) || playing.has(b)) {
        throw new Error(`${label} scheduled ${a} or ${b} twice in one round.`);
      }
      playing.add(a);
      playing.add(b);
      const key = [a, b].sort().join("\0");
      if (seen.has(key)) throw new Error(`${label} repeats ${a} vs ${b}.`);
      seen.add(key);
      games.set(a, (games.get(a) ?? 0) + 1);
      games.set(b, (games.get(b) ?? 0) + 1);
    }
  }
  if (seen.size !== expected) {
    throw new Error(
      `${label} booked ${seen.size} matches, expected ${expected}.`,
    );
  }
  for (const name of names) {
    const played = games.get(name) ?? 0;
    if (played !== names.length - 1) {
      throw new Error(
        `${label}: ${name} plays ${played} games, expected ${names.length - 1}.`,
      );
    }
  }
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

      const winnerId = groupFixtureWinnerId(fixture);
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

export function groupStageRoundBlocks(fixtures: BookedGroupMatch[]) {
  const byTime = new Map<number, BookedGroupMatch[]>();
  for (const match of fixtures) {
    const key = asDate(match.scheduledAt).getTime();
    const list = byTime.get(key) ?? [];
    list.push(match);
    byTime.set(key, list);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, matches], index) => {
      const lines = [...matches]
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) || a.matchNumber - b.matchNumber,
        )
        .map(
          (match) =>
            `Group ${match.group} — **${match.teamA}** vs **${match.teamB}**`,
        );
      return `**Round ${index + 1}** — ${formatScheduleWhen(new Date(time))}\n${lines.join("\n")}`;
    });
}

export function formatGroupStageDiscord(result: {
  saturday: string;
  sunday: string;
  fixtures: BookedGroupMatch[];
}) {
  const site = cupPublicUrl();
  return [
    "Group A and Group B start together. Bo1. Each team plays every other team in its group once.",
    "",
    ...groupStageRoundBlocks(result.fixtures),
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
      round: 0,
      teamA: fixture.radiantTeam.name,
      teamB: fixture.direTeam.name,
      scheduledAt: fixture.scheduledAt,
    };
  });

  const times = [...new Set(mapped.map((match) => match.scheduledAt.getTime()))].sort(
    (a, b) => a - b,
  );
  const roundOf = new Map(times.map((time, index) => [time, index + 1]));
  for (const match of mapped) {
    match.round = roundOf.get(match.scheduledAt.getTime()) ?? 1;
  }

  const nights = [
    ...new Set(mapped.map((match) => matchNightYmd(match.scheduledAt))),
  ];
  return {
    saturday: nights[0] ?? "",
    sunday: nights[1] ?? "",
    fixtures: mapped,
  };
}
