import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { hasScheduleTable, safeScheduleQuery } from "./schedule-db";
import { publicFixtureWhere } from "./dummy";
import {
  formatScheduleWhen,
  localParts,
  localToUtc,
  scheduleUtcOffsetHours,
} from "./schedule";

export const MATCH_NIGHT_TIME_CHOICES = [
  { name: "10:00 AM PKT", value: "10" },
  { name: "11:00 AM PKT", value: "11" },
  { name: "12:00 PM PKT", value: "12" },
  { name: "1:00 PM PKT", value: "13" },
  { name: "2:00 PM PKT", value: "14" },
  { name: "3:00 PM PKT", value: "15" },
  { name: "4:00 PM PKT", value: "16" },
  { name: "5:00 PM PKT", value: "17" },
  { name: "6:00 PM PKT", value: "18" },
  { name: "7:00 PM PKT", value: "19" },
  { name: "8:00 PM PKT", value: "20" },
  { name: "9:00 PM PKT", value: "21" },
  { name: "10:00 PM PKT", value: "22" },
  { name: "11:00 PM PKT", value: "23" },
  { name: "12:00 AM PKT", value: "0" },
  { name: "1:00 AM PKT", value: "1" },
  { name: "2:00 AM PKT", value: "2" },
  { name: "3:00 AM PKT", value: "3" },
  { name: "4:00 AM PKT", value: "4" },
  { name: "5:00 AM PKT", value: "5" },
  { name: "6:00 AM PKT", value: "6" },
] as const;

export const SCHEDULE_KIND_CHOICES = [
  { name: "Group stage", value: "group" },
  { name: "Regular", value: "regular" },
  { name: "Advancement", value: "adv" },
  { name: "Upper bracket", value: "ub" },
  { name: "Upper final", value: "ub_final" },
  { name: "Lower bracket", value: "lb" },
  { name: "Lower final", value: "lb_final" },
  { name: "Grand final", value: "final" },
] as const;

const PLAYOFF_BOOK_KINDS = [
  "adv",
  "ub",
  "ub_final",
  "lb",
  "lb_final",
  "final",
] as const;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const FIXTURE_INCLUDE = {
  radiantTeam: { select: { id: true, name: true } },
  direTeam: { select: { id: true, name: true } },
  match: { include: { winnerTeam: { select: { id: true, name: true } } } },
} as const;

export type ScheduleFixtureView = Prisma.ScheduledFixtureGetPayload<{
  include: typeof FIXTURE_INCLUDE;
}>;

function uniqueMatchupError(): Error {
  return new Error(
    "That matchup is already on the schedule. Use `/schedule edit` to change teams or the time.",
  );
}

function wrapUnique(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw uniqueMatchupError();
  }
  throw error;
}

async function requireTeam(name: string) {
  const trimmed = name.trim();
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const team = teams.find(
    (row) => row.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (!team) {
    throw new Error(`Team "${trimmed}" not found.`);
  }
  return team;
}

export function parseMatchNightHour(input: string): number {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  const map: Record<string, number> = {
    "10": 10,
    "11": 11,
    "12": 12,
    "13": 13,
    "14": 14,
    "15": 15,
    "16": 16,
    "17": 17,
    "18": 18,
    "19": 19,
    "20": 20,
    "21": 21,
    "22": 22,
    "23": 23,
    "0": 0,
    "00": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "10am": 10,
    "11am": 11,
    "12pm": 12,
    "1pm": 13,
    "2pm": 14,
    "3pm": 15,
    "4pm": 16,
    "5pm": 17,
    "6pm": 18,
    "7pm": 19,
    "8pm": 20,
    "9pm": 21,
    "10pm": 22,
    "11pm": 23,
    "12am": 0,
    "1am": 1,
    "2am": 2,
    "3am": 3,
    "4am": 4,
    "5am": 5,
    "6am": 6,
    "10:00": 10,
    "11:00": 11,
    "12:00": 12,
    "13:00": 13,
    "14:00": 14,
    "15:00": 15,
    "16:00": 16,
    "17:00": 17,
    "18:00": 18,
    "19:00": 19,
    "20:00": 20,
    "21:00": 21,
    "22:00": 22,
    "23:00": 23,
    "00:00": 0,
    "01:00": 1,
    "02:00": 2,
    "03:00": 3,
    "04:00": 4,
    "05:00": 5,
    "06:00": 6,
  };
  if (raw in map) return map[raw];
  throw new Error("Time must be 10:00 AM through 3:00 AM PKT (group stage also allows 4:00–6:00 AM).");
}

export function isPlayoffWindowHour(hour: number) {
  return (hour >= 10 && hour <= 23) || (hour >= 0 && hour <= 3);
}

export function isGroupNightHour(hour: number) {
  return hour >= 22 || (hour >= 0 && hour <= 6);
}

/** Saturday/Sunday 10:00 AM–11:59 PM, plus Sunday/Monday 12:00–3:00 AM. */
export function isAllowedPlayoffKickoff(scheduledAt: Date) {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(scheduledAt.getTime() + offsetH * 3_600_000);
  const hour = shifted.getUTCHours();
  const dow = shifted.getUTCDay();
  if (hour >= 10 && hour <= 23) return dow === 6 || dow === 0;
  if (hour >= 0 && hour <= 3) return dow === 0 || dow === 1;
  return false;
}

function isPlayoffBookKind(kind: string) {
  return (PLAYOFF_BOOK_KINDS as readonly string[]).includes(kind);
}

function assertScheduleWindow(kind: string, hour: number, scheduledAt: Date) {
  if (isPlayoffBookKind(kind)) {
    if (!isPlayoffWindowHour(hour) || !isAllowedPlayoffKickoff(scheduledAt)) {
      throw new Error(
        "Playoff matches can only start Saturday or Sunday, 10:00 AM–3:00 AM PKT.",
      );
    }
    return;
  }
  if (!isGroupNightHour(hour)) {
    throw new Error("Group matches must start 10:00 PM through 6:00 AM PKT.");
  }
}

export function parseWeekendDate(input: string) {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error("Date must be YYYY-MM-DD and a Saturday or Sunday.");
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const offsetH = scheduleUtcOffsetHours();
  const probe = localToUtc(year, month, day, 12, 0, offsetH);
  const { dow } = localParts(probe, offsetH);
  if (dow !== 6 && dow !== 0) {
    throw new Error(
      `${input} is a ${DAY_NAMES[dow]}. Match nights are Saturday or Sunday only.`,
    );
  }
  return {
    year,
    month,
    day,
    dow,
    slotIndex: dow === 6 ? 1 : 2,
  };
}

/** 10:00 AM–11:00 PM stay on the night date; 12:00–6:00 AM roll into the next calendar morning. */
export function kickoffFromMatchNight(
  night: { year: number; month: number; day: number },
  hour: number,
) {
  const offsetH = scheduleUtcOffsetHours();
  if (hour >= 10 && hour <= 23) {
    return localToUtc(night.year, night.month, night.day, hour, 0, offsetH);
  }
  return localToUtc(night.year, night.month, night.day + 1, hour, 0, offsetH);
}

function fridayOfMatchNight(night: { year: number; month: number; day: number; dow: number }) {
  const back = night.dow === 6 ? 1 : 2;
  return localToUtc(
    night.year,
    night.month,
    night.day - back,
    0,
    0,
    scheduleUtcOffsetHours(),
  );
}

function matchNightFromKickoff(scheduledAt: Date) {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(scheduledAt.getTime() + offsetH * 3_600_000);
  let year = shifted.getUTCFullYear();
  let month = shifted.getUTCMonth();
  let day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  if (hour < 10) {
    const prev = new Date(Date.UTC(year, month, day - 1));
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth();
    day = prev.getUTCDate();
  }
  const probe = localToUtc(year, month, day, 12, 0, offsetH);
  const { dow } = localParts(probe, offsetH);
  return { year, month, day, dow, hour };
}

async function weekendIndexForNight(night: {
  year: number;
  month: number;
  day: number;
  dow: number;
}) {
  const friday = fridayOfMatchNight(night);
  const fridayMs = friday.getTime();
  const fixtures = await prisma.scheduledFixture.findMany({
    select: { weekendIndex: true, scheduledAt: true },
  });
  for (const fixture of fixtures) {
    const existing = matchNightFromKickoff(fixture.scheduledAt);
    if (fridayOfMatchNight(existing).getTime() === fridayMs) {
      return fixture.weekendIndex;
    }
  }
  const last = await prisma.scheduledFixture.aggregate({
    _max: { weekendIndex: true },
  });
  return (last._max.weekendIndex ?? -1) + 1;
}

export function formatMatchNightTime(hour: number) {
  const choice = MATCH_NIGHT_TIME_CHOICES.find((row) => Number(row.value) === hour);
  return choice?.name ?? `${hour}:00`;
}

export function formatFixtureLine(fixture: {
  id?: string;
  scheduledAt: Date;
  kind: string;
  radiantTeam: { name: string };
  direTeam: { name: string };
}) {
  const when = formatScheduleWhen(fixture.scheduledAt);
  return `${when} — **${fixture.radiantTeam.name}** vs **${fixture.direTeam.name}** · ${fixture.kind}`;
}

export function formatFixtureChoiceLabel(fixture: {
  scheduledAt: Date;
  radiantTeam: { name: string };
  direTeam: { name: string };
}) {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(fixture.scheduledAt.getTime() + offsetH * 3_600_000);
  const dow = SHORT_DAYS[shifted.getUTCDay()];
  const month = MONTH_NAMES[shifted.getUTCMonth()];
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr = hour % 12 || 12;
  const label = `${dow} ${day} ${month} ${hr}:00 ${ampm} · ${fixture.radiantTeam.name} vs ${fixture.direTeam.name}`;
  return label.slice(0, 100);
}

export function upcomingWeekendDates(count = 8) {
  const offsetH = scheduleUtcOffsetHours();
  const now = new Date();
  const { year, month, day } = localParts(now, offsetH);
  const dates: { name: string; value: string }[] = [];
  for (let i = 0; i < 28 && dates.length < count; i++) {
    const probe = localToUtc(year, month, day + i, 12, 0, offsetH);
    const parts = localParts(probe, offsetH);
    if (parts.dow !== 6 && parts.dow !== 0) continue;
    const yyyy = String(parts.year).padStart(4, "0");
    const mm = String(parts.month + 1).padStart(2, "0");
    const dd = String(parts.day).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;
    dates.push({
      name: `${DAY_NAMES[parts.dow]} ${parts.day} ${MONTH_NAMES[parts.month]} (${value})`,
      value,
    });
  }
  return dates;
}

export async function listTeamsForSchedule() {
  return prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listEditableFixtures(limit = 25) {
  return safeScheduleQuery([], () =>
    prisma.scheduledFixture.findMany({
      where: { status: "scheduled" },
      include: {
        radiantTeam: { select: { name: true } },
        direTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    }),
  );
}

export async function listCupSchedule(opts?: { publicOnly?: boolean }) {
  return safeScheduleQuery([], () =>
    prisma.scheduledFixture.findMany({
      where: opts?.publicOnly ? publicFixtureWhere : undefined,
      include: FIXTURE_INCLUDE,
      orderBy: { scheduledAt: "asc" },
    }),
  );
}

async function requireFixture(id: string) {
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id },
    include: FIXTURE_INCLUDE,
  });
  if (!fixture) {
    throw new Error("Fixture not found. Use `/schedule list` or pick it from the dropdown.");
  }
  return fixture;
}

export async function createScheduledMatch(input: {
  teamA: string;
  teamB: string;
  date: string;
  time: string;
  kind?: string;
  slotKey?: string;
  bestOf?: number;
  skipPlayoffGate?: boolean;
}) {
  if (!hasScheduleTable()) {
    throw new Error("Schedule table is missing. Run `npm run db:push`.");
  }
  const radiant = await requireTeam(input.teamA);
  const dire = await requireTeam(input.teamB);
  if (radiant.id === dire.id) {
    throw new Error("Pick two different teams.");
  }
  const night = parseWeekendDate(input.date);
  const hour = parseMatchNightHour(input.time);
  const scheduledAt = kickoffFromMatchNight(night, hour);
  const weekendIndex = await weekendIndexForNight(night);
  const kind = input.kind?.trim() || "group";
  assertScheduleWindow(kind, hour, scheduledAt);
  if (isPlayoffBookKind(kind) && !input.skipPlayoffGate) {
    const { assertPlayoffMatchAllowed } = await import("./playoff-bracket");
    await assertPlayoffMatchAllowed(kind);
  }
  const bestOf = input.bestOf ?? (kind === "final" ? 3 : 1);

  try {
    return await prisma.scheduledFixture.create({
      data: {
        radiantTeamId: radiant.id,
        direTeamId: dire.id,
        scheduledAt,
        weekendIndex,
        slotIndex: night.slotIndex,
        kind,
        slotKey: input.slotKey,
        bestOf,
        status: "scheduled",
        reminderSent: false,
      },
      include: FIXTURE_INCLUDE,
    });
  } catch (error) {
    wrapUnique(error);
  }
}

export async function updateScheduledMatch(input: {
  fixtureId: string;
  teamA?: string | null;
  teamB?: string | null;
  date?: string | null;
  time?: string | null;
  kind?: string | null;
}) {
  const fixture = await requireFixture(input.fixtureId);
  if (fixture.status === "completed") {
    throw new Error("That match is already completed. Schedule a new one if you need a rematch.");
  }

  let radiantId = fixture.radiantTeamId;
  let direId = fixture.direTeamId;
  if (input.teamA?.trim()) {
    radiantId = (await requireTeam(input.teamA)).id;
  }
  if (input.teamB?.trim()) {
    direId = (await requireTeam(input.teamB)).id;
  }
  if (radiantId === direId) {
    throw new Error("Pick two different teams.");
  }

  const currentNight = matchNightFromKickoff(fixture.scheduledAt);
  const night = input.date?.trim()
    ? parseWeekendDate(input.date)
    : {
        year: currentNight.year,
        month: currentNight.month,
        day: currentNight.day,
        dow: currentNight.dow,
        slotIndex: currentNight.dow === 6 ? 1 : currentNight.dow === 0 ? 2 : fixture.slotIndex,
      };
  const hour = input.time?.trim()
    ? parseMatchNightHour(input.time)
    : currentNight.hour >= 22
      ? currentNight.hour
      : currentNight.hour;
  const scheduledAt = kickoffFromMatchNight(night, hour);
  const timeChanged = scheduledAt.getTime() !== fixture.scheduledAt.getTime();
  const weekendIndex = await weekendIndexForNight(night);
  const kind = input.kind?.trim() || fixture.kind;
  assertScheduleWindow(kind, hour, scheduledAt);
  const bestOf =
    kind === "final" ? Math.max(fixture.bestOf, 3) : fixture.bestOf;

  try {
    return await prisma.scheduledFixture.update({
      where: { id: fixture.id },
      data: {
        radiantTeamId: radiantId,
        direTeamId: direId,
        scheduledAt,
        weekendIndex,
        slotIndex: night.slotIndex,
        kind,
        bestOf,
        reminderSent: timeChanged ? false : fixture.reminderSent,
      },
      include: FIXTURE_INCLUDE,
    });
  } catch (error) {
    wrapUnique(error);
  }
}

export async function deleteScheduledMatch(fixtureId: string) {
  const fixture = await requireFixture(fixtureId);
  if (fixture.status === "completed") {
    throw new Error("That match is already completed, so it cannot be deleted.");
  }
  await prisma.scheduledFixture.delete({ where: { id: fixture.id } });
  return fixture;
}

export function groupScheduleByNight(fixtures: ScheduleFixtureView[]) {
  const groups = new Map<string, { label: string; sort: number; fixtures: ScheduleFixtureView[] }>();
  for (const fixture of fixtures) {
    const night = matchNightFromKickoff(fixture.scheduledAt);
    const key = `${night.year}-${night.month}-${night.day}`;
    const label = `${DAY_NAMES[night.dow]} ${night.day} ${MONTH_NAMES[night.month]}`;
    const sort = Date.UTC(night.year, night.month, night.day);
    const group = groups.get(key) ?? { label, sort, fixtures: [] };
    group.fixtures.push(fixture);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.sort - b.sort);
}
