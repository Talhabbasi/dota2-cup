import { MIN_ROSTER } from "./constants";
import { formatMatchTimesAllZones, weekendSlotLabel } from "./match-times";
import {
  deriveTeamPlayWindow,
  matchKickoffWindow,
  playWindowOrBoth,
  type KickoffWindow,
  type PlayWindow,
  windowsOverlap,
} from "./play-window";
import { prisma } from "./prisma";
import { hasScheduleTable, safeScheduleQuery } from "./schedule-db";

export const MAX_GAMES_PER_TEAM_PER_WEEKEND = 2;
export const MATCHES_PER_WEEKEND = 3;
export const REGULAR_BEST_OF = 1;
export const FINAL_BEST_OF = 3;
export const SERIES_WINS_FOR_FINAL = 2;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function scheduleUtcOffsetHours(): number {
  const raw = process.env.SCHEDULE_UTC_OFFSET_HOURS;
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) ? n : 5;
}

export function scheduleMatchHourLocal(): number {
  const raw = process.env.SCHEDULE_MATCH_HOUR_LOCAL;
  const n = raw ? Number(raw) : 23;
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 23;
}

export function scheduleMatchMinuteLocal(): number {
  const raw = process.env.SCHEDULE_MATCH_MINUTE_LOCAL;
  const n = raw ? Number(raw) : 30;
  return Number.isFinite(n) ? Math.min(59, Math.max(0, n)) : 30;
}

export function scheduleLateHourLocal(): number {
  const raw = process.env.SCHEDULE_LATE_HOUR_LOCAL;
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0;
}

export function scheduleLateMinuteLocal(): number {
  const raw = process.env.SCHEDULE_LATE_MINUTE_LOCAL;
  const n = raw ? Number(raw) : 30;
  return Number.isFinite(n) ? Math.min(59, Math.max(0, n)) : 30;
}

function localParts(date: Date, offsetH: number) {
  const shifted = new Date(date.getTime() + offsetH * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

function localToUtc(
  year: number,
  month: number,
  day: number,
  hourLocal: number,
  minuteLocal: number,
  offsetH: number,
): Date {
  return new Date(
    Date.UTC(year, month, day, hourLocal - offsetH, minuteLocal, 0, 0),
  );
}

export function resolveWeekendFriday(from = new Date(), offsetH = scheduleUtcOffsetHours()): Date {
  const { year, month, day, dow } = localParts(from, offsetH);
  let daysUntilFriday = (5 - dow + 7) % 7;
  if (dow === 6) daysUntilFriday = 6;
  if (dow === 0) daysUntilFriday = 5;

  const base = new Date(Date.UTC(year, month, day + daysUntilFriday));
  return localToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    0,
    0,
    offsetH,
  );
}

export function parseFridayInput(input: string, offsetH = scheduleUtcOffsetHours()): Date {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error("Use YYYY-MM-DD for the Friday that starts the weekend.");
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const probe = localToUtc(year, month, day, 12, 0, offsetH);
  const { dow } = localParts(probe, offsetH);
  if (dow !== 5) {
    throw new Error("That date is not a Friday in your schedule timezone.");
  }
  return localToUtc(year, month, day, 0, 0, offsetH);
}

export function formatScheduleWhen(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(d.getTime() + offsetH * 3_600_000);
  const dow = DAY_NAMES[shifted.getUTCDay()];
  const month = MONTH_NAMES[shifted.getUTCMonth()];
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr = hour % 12 || 12;
  const min = minute.toString().padStart(2, "0");
  return `${dow}, ${month} ${day} · ${hr}:${min} ${ampm} PKT`;
}

type TeamRow = {
  id: string;
  name: string;
  players: unknown[];
  playWindow: PlayWindow;
};

type OrientedPair = { radiant: TeamRow; dire: TeamRow };

export type PlannedFixture = {
  radiantTeamId: string;
  direTeamId: string;
  scheduledAt: Date;
  radiantName: string;
  direName: string;
  weekendIndex: number;
  slotIndex: number;
  kind?: "regular" | "final";
  bestOf?: number;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

async function completedPairKeys() {
  const keys = new Set<string>();
  const matches = await prisma.match.findMany({
    select: { radiantTeamId: true, direTeamId: true },
  });
  for (const match of matches) {
    if (match.radiantTeamId && match.direTeamId) {
      keys.add(pairKey(match.radiantTeamId, match.direTeamId));
    }
  }
  const fixtures = await prisma.scheduledFixture.findMany({
    where: { status: "completed" },
    select: { radiantTeamId: true, direTeamId: true },
  });
  for (const fixture of fixtures) {
    keys.add(pairKey(fixture.radiantTeamId, fixture.direTeamId));
  }
  return keys;
}

function orientPair(a: TeamRow, b: TeamRow): OrientedPair {
  return a.name.localeCompare(b.name) <= 0
    ? { radiant: a, dire: b }
    : { radiant: b, dire: a };
}

function roundRobinPairs(teams: TeamRow[]) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const pairs: OrientedPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push(orientPair(sorted[i], sorted[j]));
    }
  }
  return pairs;
}

function scorePairForWeekend(
  pair: OrientedPair,
  weekendCounts: Map<string, number>,
): number | null {
  const rc = weekendCounts.get(pair.radiant.id) ?? 0;
  const dc = weekendCounts.get(pair.dire.id) ?? 0;
  if (rc >= MAX_GAMES_PER_TEAM_PER_WEEKEND || dc >= MAX_GAMES_PER_TEAM_PER_WEEKEND) {
    return null;
  }
  let score = (rc === 0 ? 30 : 0) + (dc === 0 ? 30 : 0) - (rc + dc) * 8;
  if (windowsOverlap(pair.radiant.playWindow, pair.dire.playWindow)) {
    score += 24;
  } else {
    score -= 40;
  }
  return score;
}

function kickoffAt(
  start: { year: number; month: number; day: number },
  weekendIndex: number,
  slot: number,
  window: KickoffWindow,
  offsetH: number,
): Date {
  const dayOffset = weekendIndex * 7 + slot;
  if (window === "late") {
    return localToUtc(
      start.year,
      start.month,
      start.day + dayOffset + 1,
      scheduleLateHourLocal(),
      scheduleLateMinuteLocal(),
      offsetH,
    );
  }
  return localToUtc(
    start.year,
    start.month,
    start.day + dayOffset,
    scheduleMatchHourLocal(),
    scheduleMatchMinuteLocal(),
    offsetH,
  );
}

export function kickoffWindowFromDate(date: Date): KickoffWindow {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(date.getTime() + offsetH * 3_600_000);
  return shifted.getUTCHours() < 12 ? "late" : "evening";
}

function distributeWeekendSlots(
  pairs: OrientedPair[],
  firstFriday: Date,
): PlannedFixture[] {
  const remaining = [...pairs];
  const result: PlannedFixture[] = [];
  const offsetH = scheduleUtcOffsetHours();
  const start = localParts(firstFriday, offsetH);
  let weekendIndex = 0;

  while (remaining.length > 0) {
    const weekendCounts = new Map<string, number>();
    let scheduledThisWeekend = 0;

    for (let slot = 0; slot < MATCHES_PER_WEEKEND && remaining.length > 0; slot++) {
      let bestIdx = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const score = scorePairForWeekend(remaining[i], weekendCounts);
        if (score == null) continue;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      const pair = remaining.splice(bestIdx, 1)[0];
      const scheduledAt = kickoffAt(
        start,
        weekendIndex,
        slot,
        matchKickoffWindow(pair.radiant.playWindow, pair.dire.playWindow),
        offsetH,
      );

      weekendCounts.set(pair.radiant.id, (weekendCounts.get(pair.radiant.id) ?? 0) + 1);
      weekendCounts.set(pair.dire.id, (weekendCounts.get(pair.dire.id) ?? 0) + 1);

      result.push({
        radiantTeamId: pair.radiant.id,
        direTeamId: pair.dire.id,
        scheduledAt,
        radiantName: pair.radiant.name,
        direName: pair.dire.name,
        weekendIndex,
        slotIndex: slot,
      });
      scheduledThisWeekend++;
    }

    if (scheduledThisWeekend === 0) {
      const pair = remaining.shift()!;
      const scheduledAt = kickoffAt(
        start,
        weekendIndex,
        0,
        matchKickoffWindow(pair.radiant.playWindow, pair.dire.playWindow),
        offsetH,
      );
      result.push({
        radiantTeamId: pair.radiant.id,
        direTeamId: pair.dire.id,
        scheduledAt,
        radiantName: pair.radiant.name,
        direName: pair.dire.name,
        weekendIndex,
        slotIndex: 0,
      });
    }

    weekendIndex++;
  }

  return result;
}

function teamRowFromRoster(team: {
  id: string;
  name: string;
  players: { playWindow: string }[];
}): TeamRow {
  return {
    id: team.id,
    name: team.name,
    players: team.players,
    playWindow: deriveTeamPlayWindow(
      team.players.map((p) => playWindowOrBoth(p.playWindow)),
    ),
  };
}

export async function validateTeamsForSchedule() {
  const teams = await prisma.team.findMany({
    include: { players: true },
    orderBy: { name: "asc" },
  });

  if (teams.length < 2) {
    throw new Error("Need at least 2 teams before generating a schedule.");
  }

  const under = teams.filter((t) => t.players.length < MIN_ROSTER);
  if (under.length > 0) {
    const names = under
      .map((t) => `**${t.name}** (${t.players.length}/${MIN_ROSTER})`)
      .join(", ");
    throw new Error(
      `These teams need at least ${MIN_ROSTER} players: ${names}. Finish rosters first.`,
    );
  }

  return teams;
}

export async function generateWeekendSchedule(input?: {
  friday?: string;
  force?: boolean;
}) {
  const teams = await validateTeamsForSchedule();
  const pending = await prisma.scheduledFixture.count({
    where: { status: "scheduled" },
  });

  if (pending > 0 && !input?.force) {
    throw new Error(
      `${pending} fixtures are already scheduled. Run \`/schedule clear\` or \`/schedule generate force:true\` to replace them.`,
    );
  }

  const offsetH = scheduleUtcOffsetHours();
  const firstFriday = input?.friday
    ? parseFridayInput(input.friday, offsetH)
    : resolveWeekendFriday(new Date(), offsetH);

  const played = await completedPairKeys();
  const pairs = roundRobinPairs(teams.map(teamRowFromRoster)).filter(
    (pair) => !played.has(pairKey(pair.radiant.id, pair.dire.id)),
  );

  if (pairs.length === 0) {
    throw new Error("Every team pairing has already been played or scheduled.");
  }

  const fixtures = distributeWeekendSlots(pairs, firstFriday);

  await prisma.$transaction(async (tx) => {
    if (input?.force || pending > 0) {
      await tx.scheduledFixture.deleteMany({ where: { status: "scheduled" } });
    }
    await tx.scheduledFixture.createMany({
      data: fixtures.map((f) => ({
        radiantTeamId: f.radiantTeamId,
        direTeamId: f.direTeamId,
        scheduledAt: f.scheduledAt,
        weekendIndex: f.weekendIndex,
        slotIndex: f.slotIndex,
        kind: "regular",
        bestOf: REGULAR_BEST_OF,
        status: "scheduled",
      })),
    });
  });

  return {
    teamCount: teams.length,
    matchCount: fixtures.length,
    firstFriday,
    fixtures,
  };
}

export async function clearScheduledFixtures() {
  const removed = await prisma.scheduledFixture.deleteMany({
    where: { status: "scheduled" },
  });
  return removed.count;
}

export async function listScheduledFixtures(limit = 20) {
  return safeScheduleQuery([], () =>
    prisma.scheduledFixture.findMany({
      where: { status: "scheduled" },
      include: { radiantTeam: true, direTeam: true },
      orderBy: [{ weekendIndex: "asc" }, { slotIndex: "asc" }],
      take: limit,
    }),
  );
}

export async function getNextScheduledFixture() {
  return safeScheduleQuery(null, () =>
    prisma.scheduledFixture.findFirst({
      where: { status: "scheduled" },
      include: { radiantTeam: true, direTeam: true },
      orderBy: { scheduledAt: "asc" },
    }),
  );
}

export async function getWeekendFixtures(weekendIndex: number) {
  return safeScheduleQuery([], () =>
    prisma.scheduledFixture.findMany({
      where: { weekendIndex },
      include: {
        radiantTeam: true,
        direTeam: true,
        match: { include: { winnerTeam: true } },
      },
      orderBy: { slotIndex: "asc" },
    }),
  );
}

export async function getActiveWeekendBundle() {
  return safeScheduleQuery(null, async () => {
    const next = await getNextScheduledFixture();
    if (!next) return null;

    const fixtures = await getWeekendFixtures(next.weekendIndex);
    const champion = await getWeekendChampion(next.weekendIndex);
    return { weekendIndex: next.weekendIndex, fixtures, champion };
  });
}

export async function getWeekendChampion(weekendIndex: number) {
  return safeScheduleQuery(null, async () => {
    const fixtures = await prisma.scheduledFixture.findMany({
      where: { weekendIndex, status: "completed" },
      include: { match: { include: { winnerTeam: true } } },
      orderBy: { slotIndex: "asc" },
    });

    if (fixtures.length < MATCHES_PER_WEEKEND) return null;

    const wins = new Map<string, { id: string; name: string; count: number }>();
    for (const fixture of fixtures) {
      const winner = fixture.match?.winnerTeam;
      if (!winner) return null;
      const row = wins.get(winner.id) ?? { id: winner.id, name: winner.name, count: 0 };
      row.count += 1;
      wins.set(winner.id, row);
    }

    const ranked = [...wins.values()].sort((a, b) => b.count - a.count);
    const top = ranked[0];
    if (!top) return null;
    if (top.count >= SERIES_WINS_FOR_FINAL) return top;
    if (ranked[1] && top.count === ranked[1].count) return null;
    return top.count > 0 ? top : null;
  });
}

export async function generateGrandFinal(input?: {
  friday?: string;
  force?: boolean;
}) {
  const pendingRegular = await prisma.scheduledFixture.count({
    where: { status: "scheduled", kind: "regular" },
  });
  if (pendingRegular > 0 && !input?.force) {
    throw new Error(
      `${pendingRegular} regular fixtures are still open. Finish the season or pass force:true.`,
    );
  }

  const existingFinal = await prisma.scheduledFixture.findFirst({
    where: { kind: "final", status: "scheduled" },
  });
  if (existingFinal && !input?.force) {
    throw new Error(
      "A grand final is already scheduled. Run `/schedule clear` or `/schedule final force:true`.",
    );
  }

  const { getStandings } = await import("./data");
  const table = await getStandings();
  if (table.length < 2) {
    throw new Error("Need at least 2 teams to schedule a grand final.");
  }
  if (table[0].played === 0 && table[1].played === 0) {
    throw new Error("Need regular-season results before seeding the top 2.");
  }

  const first = table[0];
  const second = table[1];
  const offsetH = scheduleUtcOffsetHours();
  const friday = input?.friday
    ? parseFridayInput(input.friday, offsetH)
    : resolveWeekendFriday(new Date(), offsetH);
  const start = localParts(friday, offsetH);
  const rosterWindows = await prisma.team.findMany({
    where: { id: { in: [first.id, second.id] } },
    include: { players: { select: { playWindow: true } } },
  });
  const windowByTeam = new Map(
    rosterWindows.map((t) => [t.id, teamRowFromRoster(t).playWindow]),
  );
  const scheduledAt = kickoffAt(
    start,
    0,
    0,
    matchKickoffWindow(
      windowByTeam.get(first.id) ?? "both",
      windowByTeam.get(second.id) ?? "both",
    ),
    offsetH,
  );
  const lastWeekend = await prisma.scheduledFixture.aggregate({
    _max: { weekendIndex: true },
  });
  const weekendIndex = (lastWeekend._max.weekendIndex ?? -1) + 1;
  const oriented =
    first.name.localeCompare(second.name) <= 0
      ? { radiant: first, dire: second }
      : { radiant: second, dire: first };

  if (existingFinal && input?.force) {
    await prisma.scheduledFixture.deleteMany({
      where: { kind: "final", status: "scheduled" },
    });
  }

  const fixture = await prisma.scheduledFixture.create({
    data: {
      radiantTeamId: oriented.radiant.id,
      direTeamId: oriented.dire.id,
      scheduledAt,
      weekendIndex,
      slotIndex: 0,
      kind: "final",
      bestOf: FINAL_BEST_OF,
      status: "scheduled",
    },
    include: { radiantTeam: true, direTeam: true },
  });

  return {
    radiantName: fixture.radiantTeam.name,
    direName: fixture.direTeam.name,
    scheduledAt: fixture.scheduledAt,
    bestOf: FINAL_BEST_OF,
  };
}

export async function completeScheduledFixture(input: {
  radiantTeamId: string | null;
  direTeamId: string | null;
  winnerTeamId: string | null;
  matchId: string;
}) {
  if (!input.radiantTeamId || !input.direTeamId || !hasScheduleTable()) return;

  try {
    const keyA = [input.radiantTeamId, input.direTeamId].sort();
    const fixture = await prisma.scheduledFixture.findFirst({
      where: {
        status: "scheduled",
        OR: [
          { radiantTeamId: keyA[0], direTeamId: keyA[1] },
          { radiantTeamId: keyA[1], direTeamId: keyA[0] },
        ],
      },
      orderBy: [{ kind: "asc" }, { scheduledAt: "asc" }],
    });

    if (!fixture) return;

    const radiantWins =
      fixture.radiantWins + (input.winnerTeamId === fixture.radiantTeamId ? 1 : 0);
    const direWins =
      fixture.direWins + (input.winnerTeamId === fixture.direTeamId ? 1 : 0);
    const needed = Math.ceil((fixture.bestOf || REGULAR_BEST_OF) / 2);
    const seriesOver = radiantWins >= needed || direWins >= needed;

    await prisma.scheduledFixture.update({
      where: { id: fixture.id },
      data: {
        matchId: input.matchId,
        radiantWins,
        direWins,
        status: seriesOver ? "completed" : "scheduled",
      },
    });
  } catch {
    /* schedule optional until admin runs /schedule generate */
  }
}

export function formatScheduleSummary(
  fixtures: Awaited<ReturnType<typeof listScheduledFixtures>>,
): string {
  if (fixtures.length === 0) return "No fixtures scheduled.";

  const lines: string[] = [];
  let lastWeekend = -1;
  for (const f of fixtures) {
    if (f.weekendIndex !== lastWeekend) {
      lastWeekend = f.weekendIndex;
      lines.push(
        f.kind === "final"
          ? `\n**Grand Final** (best of ${f.bestOf} · first to ${Math.ceil(f.bestOf / 2)})`
          : `\n**Weekend ${f.weekendIndex + 1}** (Fri / Sat / Sun · BO1 · 11:30 PM or 12:30 AM PKT · max 2 games per team)`,
      );
    }
    const day = f.kind === "final" ? "Final" : weekendSlotLabel(f.slotIndex);
    const pkt = formatScheduleWhen(f.scheduledAt);
    const window =
      kickoffWindowFromDate(f.scheduledAt) === "late"
        ? " · after 12am"
        : " · 8pm–12am";
    const series =
      f.bestOf > 1 ? ` · BO${f.bestOf} ${f.radiantWins}–${f.direWins}` : " · BO1";
    lines.push(
      `${day} — **${f.radiantTeam.name}** vs **${f.direTeam.name}**${series}${window} · ${pkt}`,
    );
  }
  return lines.join("\n").trim();
}

export { formatMatchTimesAllZones } from "./match-times";