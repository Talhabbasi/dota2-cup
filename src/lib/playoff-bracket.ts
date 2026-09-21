import { prisma } from "./prisma";
import { FINAL_BEST_OF, REGULAR_BEST_OF, scheduleUtcOffsetHours } from "./schedule";
import {
  createScheduledMatch,
  isAllowedPlayoffKickoff,
} from "./schedule-crud";
import {
  getGroupStandings,
  groupStageComplete,
  type GroupStandingRow,
} from "./group-stage-schedule";
import {
  BRACKET_META,
  BRACKET_SLOTS,
  type BracketSlot,
  type GroupSeeds,
  type NamedTeam,
  type SlotResult,
} from "./playoff-tree";

export {
  BRACKET_META,
  BRACKET_SLOTS,
  PLAYOFF_BOOK_KINDS,
  eliminatedFromSeeds,
  initialPairings,
  isBracketSlot,
  isPlayoffBookKind,
  pairingReady,
  unlockedPairings,
  type BracketMeta,
  type BracketSlot,
  type GroupSeeds,
  type NamedTeam,
  type SlotPairing,
  type SlotResult,
} from "./playoff-tree";

export function seedsFromStandings(
  groupA: GroupStandingRow[],
  groupB: GroupStandingRow[],
): GroupSeeds | null {
  if (groupA.length < 4 || groupB.length < 4) return null;
  if (groupA.some((row) => row.played < 3) || groupB.some((row) => row.played < 3)) {
    return null;
  }
  const a = groupA.slice(0, 4);
  const b = groupB.slice(0, 4);
  return {
    a1: { id: a[0].id, name: a[0].name },
    a2: { id: a[1].id, name: a[1].name },
    a3: { id: a[2].id, name: a[2].name },
    a4: { id: a[3].id, name: a[3].name },
    b1: { id: b[0].id, name: b[0].name },
    b2: { id: b[1].id, name: b[1].name },
    b3: { id: b[2].id, name: b[2].name },
    b4: { id: b[3].id, name: b[3].name },
  };
}

function teamOf(
  id: string,
  radiant: NamedTeam,
  dire: NamedTeam,
): NamedTeam | null {
  if (id === radiant.id) return radiant;
  if (id === dire.id) return dire;
  return null;
}

export function seriesWinnerLoser(fixture: {
  radiantTeamId: string;
  direTeamId: string;
  radiantWins: number;
  direWins: number;
  radiantTeam: NamedTeam;
  direTeam: NamedTeam;
}): SlotResult | null {
  if (fixture.radiantWins === fixture.direWins) return null;
  const winnerId =
    fixture.radiantWins > fixture.direWins
      ? fixture.radiantTeamId
      : fixture.direTeamId;
  const winner = teamOf(winnerId, fixture.radiantTeam, fixture.direTeam);
  const loser = teamOf(
    winnerId === fixture.radiantTeamId
      ? fixture.direTeamId
      : fixture.radiantTeamId,
    fixture.radiantTeam,
    fixture.direTeam,
  );
  if (!winner || !loser) return null;
  return { winner, loser };
}

const TEAM_REST_MS = 2 * 60 * 60 * 1000;
const MATCH_BUFFER_MS = 60 * 60 * 1000;

function ceilToHour(date: Date) {
  const t = new Date(date);
  if (t.getUTCMinutes() > 0 || t.getUTCSeconds() > 0 || t.getUTCMilliseconds() > 0) {
    t.setUTCMinutes(0, 0, 0);
    t.setUTCHours(t.getUTCHours() + 1);
  } else {
    t.setUTCSeconds(0, 0);
  }
  return t;
}

export function nextPlayoffKickoff(input: {
  after: Date;
  occupied: Date[];
  teamBusy: { teamId: string; at: Date }[];
  teamIds: string[];
}): Date {
  const occupied = input.occupied.map((d) => d.getTime());
  let cursor = ceilToHour(new Date(input.after.getTime() + MATCH_BUFFER_MS));
  const deadline = cursor.getTime() + 21 * 24 * 60 * 60 * 1000;

  while (cursor.getTime() < deadline) {
    if (isAllowedPlayoffKickoff(cursor)) {
      const t = cursor.getTime();
      const clash = occupied.some((ms) => Math.abs(ms - t) < MATCH_BUFFER_MS);
      const teamClash = input.teamBusy.some(
        (row) =>
          input.teamIds.includes(row.teamId) &&
          Math.abs(row.at.getTime() - t) < TEAM_REST_MS,
      );
      if (!clash && !teamClash) return cursor;
    }
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
  }

  throw new Error("Could not find a Saturday/Sunday 10:00 AM–3:00 AM PKT slot for the next playoff match.");
}

function nightDateString(scheduledAt: Date) {
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
  return {
    date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    time: String(hour),
  };
}

function orientNames(a: NamedTeam, b: NamedTeam) {
  return a.name.localeCompare(b.name) <= 0 ? { left: a, right: b } : { left: b, right: a };
}

async function loadSeeds(): Promise<GroupSeeds | null> {
  if (!(await groupStageComplete())) return null;
  const [groupA, groupB] = await Promise.all([
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  return seedsFromStandings(groupA, groupB);
}

async function fixturesBySlot() {
  const rows = await prisma.scheduledFixture.findMany({
    where: { slotKey: { in: [...BRACKET_SLOTS] } },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
    },
  });
  return new Map(rows.filter((row) => row.slotKey).map((row) => [row.slotKey as BracketSlot, row]));
}

function resultsFromFixtures(
  bySlot: Awaited<ReturnType<typeof fixturesBySlot>>,
): Partial<Record<BracketSlot, SlotResult>> {
  const results: Partial<Record<BracketSlot, SlotResult>> = {};
  for (const slot of BRACKET_SLOTS) {
    const fixture = bySlot.get(slot);
    if (!fixture || fixture.status !== "completed") continue;
    const outcome = seriesWinnerLoser(fixture);
    if (outcome) results[slot] = outcome;
  }
  return results;
}

async function scheduleOccupancy() {
  const fixtures = await prisma.scheduledFixture.findMany({
    select: {
      scheduledAt: true,
      radiantTeamId: true,
      direTeamId: true,
    },
  });
  return {
    occupied: fixtures.map((row) => row.scheduledAt),
    teamBusy: fixtures.flatMap((row) => [
      { teamId: row.radiantTeamId, at: row.scheduledAt },
      { teamId: row.direTeamId, at: row.scheduledAt },
    ]),
  };
}

async function lastGroupKickoff() {
  const last = await prisma.scheduledFixture.findFirst({
    where: { kind: "group" },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });
  return last?.scheduledAt ?? new Date();
}

async function bookSlot(input: {
  slotKey: BracketSlot;
  left: NamedTeam;
  right: NamedTeam;
  after: Date;
}) {
  const existing = await prisma.scheduledFixture.findUnique({
    where: { slotKey: input.slotKey },
  });
  if (existing) return existing;

  const meta = BRACKET_META[input.slotKey];
  const sides = orientNames(input.left, input.right);
  const occupancy = await scheduleOccupancy();
  const scheduledAt = nextPlayoffKickoff({
    after: input.after,
    occupied: occupancy.occupied,
    teamBusy: occupancy.teamBusy,
    teamIds: [sides.left.id, sides.right.id],
  });
  const night = nightDateString(scheduledAt);

  return createScheduledMatch({
    teamA: sides.left.name,
    teamB: sides.right.name,
    date: night.date,
    time: night.time,
    kind: meta.kind,
    slotKey: input.slotKey,
    bestOf: meta.bestOf,
    skipPlayoffGate: true,
  });
}

export async function maybeOpenPlayoffsFromGroups() {
  const seeds = await loadSeeds();
  if (!seeds) return { opened: false as const, created: [] as BracketSlot[] };

  const bySlot = await fixturesBySlot();
  if (bySlot.has("ub1") && bySlot.has("ub2")) {
    return { opened: false as const, created: [] as BracketSlot[] };
  }

  const first = initialPairings(seeds);
  const after = await lastGroupKickoff();
  const created: BracketSlot[] = [];
  let cursor = after;

  for (const slot of ["ub1", "ub2"] as const) {
    if (bySlot.has(slot)) continue;
    const pair = first[slot];
    const booked = await bookSlot({
      slotKey: slot,
      left: pair.left,
      right: pair.right,
      after: cursor,
    });
    created.push(slot);
    cursor = booked.scheduledAt;
  }

  return { opened: created.length > 0, created };
}

export async function advanceBracket() {
  const seeds = await loadSeeds();
  if (!seeds) return { created: [] as BracketSlot[] };

  const bySlot = await fixturesBySlot();
  const results = resultsFromFixtures(bySlot);
  const pairings = unlockedPairings(seeds, results);
  const created: BracketSlot[] = [];

  const dependents: BracketSlot[] = ["lb1", "lb2", "lb3", "uf", "lb_final", "final"];
  for (const slot of dependents) {
    if (bySlot.has(slot)) continue;
    const pair = pairings[slot];
    if (!pair.left || !pair.right) continue;
    const afterTimes = [await lastGroupKickoff()];
    const prereqSlots: BracketSlot[] =
      slot === "lb1"
        ? ["ub1"]
        : slot === "lb2"
          ? ["ub2"]
          : slot === "lb3"
            ? ["lb1", "lb2"]
            : slot === "uf"
              ? ["ub1", "ub2"]
              : slot === "lb_final"
                ? ["lb3", "uf"]
                : ["uf", "lb_final"];
    for (const key of prereqSlots) {
      const fixture = bySlot.get(key);
      if (fixture) afterTimes.push(fixture.scheduledAt);
    }
    const after = new Date(Math.max(...afterTimes.map((d) => d.getTime())));
    await bookSlot({
      slotKey: slot,
      left: pair.left,
      right: pair.right,
      after,
    });
    created.push(slot);
    bySlot.set(slot, (await fixturesBySlot()).get(slot)!);
  }

  return { created };
}

export async function assertPlayoffMatchAllowed(kind: string) {
  if (!isPlayoffBookKind(kind)) return;
  if (!(await groupStageComplete())) {
    throw new Error(
      "Playoff matches unlock after every Group A and Group B match is completed.",
    );
  }

  const bySlot = await fixturesBySlot();
  const done = (slot: BracketSlot) => bySlot.get(slot)?.status === "completed";

  if (kind === "lb" && !(done("ub1") || done("ub2"))) {
    throw new Error(
      "Lower bracket matches unlock after Upper Round 1. Group A 3rd plays the A1 vs B2 loser; Group B 3rd plays the B1 vs A2 loser.",
    );
  }
  if (kind === "ub_final" && !(done("ub1") && done("ub2"))) {
    throw new Error(
      "The Upper Final unlocks after both Upper Round 1 matches are completed.",
    );
  }
  if (kind === "lb_final" && !(done("lb3") && done("uf"))) {
    throw new Error(
      "The Lower Final unlocks after Lower Round 2 and the Upper Final.",
    );
  }
  if (kind === "final" && !(done("uf") && done("lb_final"))) {
    throw new Error(
      "The Grand Final unlocks after the Upper Final and Lower Final.",
    );
  }
}

export async function loadPlayoffSeeds() {
  const [groupA, groupB] = await Promise.all([
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  const complete =
    groupA.length === 4 &&
    groupB.length === 4 &&
    groupA.every((row) => row.played === 3) &&
    groupB.every((row) => row.played === 3);
  return {
    groupA,
    groupB,
    complete,
    seeds: complete ? seedsFromStandings(groupA, groupB) : null,
  };
}
