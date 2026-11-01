import { unstable_cache } from "next/cache";
import { cupPublicUrl } from "./brand";
import { prisma } from "./prisma";
import { publicTeamWhere } from "./dummy";
import { formatScheduleWhen, scheduleUtcOffsetHours, asDate } from "./schedule";
import { currentSeasonFilter } from "./seasons";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import {
  createScheduledMatch,
  kickoffFromMatchNight,
  parseMatchNightHour,
  parseWeekendDate,
  upcomingWeekendDates,
} from "./schedule-crud";
import { getLivePlayoffFormat, roundRobinRounds } from "./playoff-format";
import { applyGroupFixtures } from "./season-data";

/** One Group A match and one Group B match per hour, 8:00 PM through 6:00 AM PKT. */
const GROUP_NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];

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
  /** Team kills across decided group games. Breaks a tie on points. */
  kills: number;
  /** Kills conceded. Used only when two teams also have the same kill total. */
  conceded: number;
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
  /** First kickoff hour in PKT. Default 8:00 PM. Finished matches are left alone. */
  startHour?: number;
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

  const startHour = input?.startHour ?? 20;
  if (!GROUP_NIGHT_HOURS.includes(startHour)) {
    throw new Error("Group matches start 8:00 PM through 6:00 AM PKT.");
  }

  const roundsA = roundRobinRounds(groupA);
  const roundsB = roundRobinRounds(groupB);
  assertFullRoundRobin(groupA, roundsA, "Group A");
  assertFullRoundRobin(groupB, roundsB, "Group B");
  const roundCount = Math.max(roundsA.length, roundsB.length);

  const completed = await prisma.scheduledFixture.findMany({
    where: { status: "completed", kind: "group", ...season },
    select: {
      radiantTeam: { select: { name: true } },
      direTeam: { select: { name: true } },
    },
  });
  const played = new Set(
    completed.map((row) => pairKey(row.radiantTeam.name, row.direTeam.name)),
  );

  const pendingRows = await prisma.scheduledFixture.findMany({
    where: { status: "scheduled", kind: "group", ...season },
    select: {
      id: true,
      radiantTeam: { select: { name: true } },
      direTeam: { select: { name: true } },
    },
  });
  if (pendingRows.length > 0 && !input?.force) {
    throw new Error(
      `${pendingRows.length} group matches are already booked. Pass force to replace them, or edit a single fixture.`,
    );
  }
  const pendingByPair = new Map(
    pendingRows.map((row) => [
      pairKey(row.radiantTeam.name, row.direTeam.name),
      row.id,
    ]),
  );

  const openA: { round: number; teamA: string; teamB: string }[] = [];
  const openB: { round: number; teamA: string; teamB: string }[] = [];
  for (let round = 0; round < roundCount; round++) {
    for (const [teamA, teamB] of roundsA[round] ?? []) {
      if (!played.has(pairKey(teamA, teamB))) {
        openA.push({ round: round + 1, teamA, teamB });
      }
    }
    for (const [teamA, teamB] of roundsB[round] ?? []) {
      if (!played.has(pairKey(teamA, teamB))) {
        openB.push({ round: round + 1, teamA, teamB });
      }
    }
  }

  const slotCount = Math.max(openA.length, openB.length);
  const slots = kickoffSlots(saturday, sunday, slotCount, startHour);
  const planned: {
    group: "A" | "B";
    round: number;
    matchNumber: number;
    teamA: string;
    teamB: string;
    date: string;
    hour: string;
  }[] = [];
  for (let index = 0; index < slotCount; index++) {
    const slot = slots[index];
    if (!slot) throw new Error("Missing a kickoff slot for this group round.");
    const pairA = openA[index];
    const pairB = openB[index];
    if (pairA) {
      planned.push({
        group: "A",
        round: pairA.round,
        matchNumber: index + 1,
        teamA: pairA.teamA,
        teamB: pairA.teamB,
        date: slot.date,
        hour: slot.hour,
      });
    }
    if (pairB) {
      planned.push({
        group: "B",
        round: pairB.round,
        matchNumber: index + 1,
        teamA: pairB.teamA,
        teamB: pairB.teamB,
        date: slot.date,
        hour: slot.hour,
      });
    }
  }

  const booked: BookedGroupMatch[] = [];
  const createdIds: string[] = [];
  const keptIds = new Set<string>();
  try {
    for (const row of planned) {
      const existingId = pendingByPair.get(pairKey(row.teamA, row.teamB));
      const night = parseWeekendDate(row.date);
      const hour = parseMatchNightHour(row.hour);
      const scheduledAt = kickoffFromMatchNight(night, hour);
      const fixture = existingId
        ? await prisma.scheduledFixture.update({
            where: { id: existingId },
            data: { scheduledAt },
            include: {
              radiantTeam: { select: { name: true } },
              direTeam: { select: { name: true } },
            },
          })
        : await createScheduledMatch({
            teamA: row.teamA,
            teamB: row.teamB,
            date: row.date,
            time: row.hour,
            kind: "group",
          });
      if (existingId) keptIds.add(existingId);
      else createdIds.push(fixture.id);
      booked.push({
        group: row.group,
        matchNumber: row.matchNumber,
        round: row.round,
        teamA: fixture.radiantTeam.name,
        teamB: fixture.direTeam.name,
        scheduledAt: fixture.scheduledAt,
      });
    }
    const stale = pendingRows
      .map((row) => row.id)
      .filter((id) => !keptIds.has(id));
    if (stale.length > 0) {
      await prisma.scheduledFixture.deleteMany({ where: { id: { in: stale } } });
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

function pairKey(teamA: string, teamB: string) {
  return [teamA, teamB].sort().join("|");
}

/** First night, then the extra night, starting at the chosen hour. One slot is one parallel A+B kickoff. */
function kickoffSlots(
  saturday: string,
  sunday: string,
  roundCount: number,
  startHour: number,
) {
  const start = GROUP_NIGHT_HOURS.indexOf(startHour);
  const hours = GROUP_NIGHT_HOURS.slice(start).map(String);
  const slots: { date: string; hour: string }[] = [];
  if (roundCount === 0) return slots;
  for (let week = 0; slots.length < roundCount; week++) {
    if (week > 6) {
      throw new Error("Not enough weekend nights to fit every group round.");
    }
    for (const date of [
      addDaysYmd(saturday, week * 7),
      addDaysYmd(sunday, week * 7),
    ]) {
      for (const hour of hours) {
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
    return applyGroupFixtures(teams, fixtures);
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
