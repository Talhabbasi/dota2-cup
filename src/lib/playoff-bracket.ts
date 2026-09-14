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

export const BRACKET_SLOTS = [
  "adv",
  "ub1",
  "ub2",
  "lb1",
  "lb2",
  "uf",
  "lb_final",
  "final",
] as const;

export type BracketSlot = (typeof BRACKET_SLOTS)[number];

export const PLAYOFF_BOOK_KINDS = [
  "adv",
  "ub",
  "ub_final",
  "lb",
  "lb_final",
  "final",
] as const;

export type NamedTeam = { id: string; name: string };

export type GroupSeeds = {
  a1: NamedTeam;
  a2: NamedTeam;
  a3: NamedTeam;
  a4: NamedTeam;
  b1: NamedTeam;
  b2: NamedTeam;
  b3: NamedTeam;
  b4: NamedTeam;
};

export type SlotResult = {
  winner: NamedTeam;
  loser: NamedTeam;
};

export type SlotPairing = {
  left: NamedTeam | null;
  right: NamedTeam | null;
  leftLabel: string;
  rightLabel: string;
};

export type BracketMeta = {
  slotKey: BracketSlot;
  kind: (typeof PLAYOFF_BOOK_KINDS)[number];
  matchNumber: number | null;
  bestOf: number;
  label: string;
  stage: "advancement" | "upper" | "lower" | "grand";
  round: string;
  leftLabel: string;
  rightLabel: string;
  waiting: string;
  winnerGoes: string;
  loserGoes: string;
};

export const BRACKET_META: Record<BracketSlot, BracketMeta> = {
  adv: {
    slotKey: "adv",
    kind: "adv",
    matchNumber: null,
    bestOf: REGULAR_BEST_OF,
    label: "Advancement Match",
    stage: "advancement",
    round: "Advancement",
    leftLabel: "Group A 3rd",
    rightLabel: "Group B 3rd",
    waiting: "Waiting for Group A and Group B to finish",
    winnerGoes: "Playoffs · Lower Bracket",
    loserGoes: "Eliminated",
  },
  ub1: {
    slotKey: "ub1",
    kind: "ub",
    matchNumber: 1,
    bestOf: REGULAR_BEST_OF,
    label: "Match 1 · Upper Round 1",
    stage: "upper",
    round: "Upper Round 1",
    leftLabel: "Group A 1st",
    rightLabel: "Group B 2nd",
    waiting: "Waiting for Group A and Group B to finish",
    winnerGoes: "Upper Final",
    loserGoes: "Lower Round 1",
  },
  ub2: {
    slotKey: "ub2",
    kind: "ub",
    matchNumber: 2,
    bestOf: REGULAR_BEST_OF,
    label: "Match 2 · Upper Round 1",
    stage: "upper",
    round: "Upper Round 1",
    leftLabel: "Group B 1st",
    rightLabel: "Group A 2nd",
    waiting: "Waiting for Group A and Group B to finish",
    winnerGoes: "Upper Final",
    loserGoes: "Lower Round 2",
  },
  lb1: {
    slotKey: "lb1",
    kind: "lb",
    matchNumber: 3,
    bestOf: REGULAR_BEST_OF,
    label: "Match 3 · Lower Round 1",
    stage: "lower",
    round: "Lower Round 1",
    leftLabel: "Advancement winner",
    rightLabel: "Match 1 loser",
    waiting: "Waiting for the Advancement Match and Upper Round 1 Match 1",
    winnerGoes: "Lower Round 2",
    loserGoes: "Eliminated",
  },
  lb2: {
    slotKey: "lb2",
    kind: "lb",
    matchNumber: 4,
    bestOf: REGULAR_BEST_OF,
    label: "Match 4 · Lower Round 2",
    stage: "lower",
    round: "Lower Round 2",
    leftLabel: "Match 3 winner",
    rightLabel: "Match 2 loser",
    waiting: "Waiting for Lower Round 1 and Upper Round 1 Match 2",
    winnerGoes: "Lower Final",
    loserGoes: "Eliminated",
  },
  uf: {
    slotKey: "uf",
    kind: "ub_final",
    matchNumber: 5,
    bestOf: REGULAR_BEST_OF,
    label: "Match 5 · Upper Final",
    stage: "upper",
    round: "Upper Final",
    leftLabel: "Match 1 winner",
    rightLabel: "Match 2 winner",
    waiting: "Waiting for both Upper Round 1 matches",
    winnerGoes: "Grand Final",
    loserGoes: "Lower Final",
  },
  lb_final: {
    slotKey: "lb_final",
    kind: "lb_final",
    matchNumber: 6,
    bestOf: REGULAR_BEST_OF,
    label: "Match 6 · Lower Final",
    stage: "lower",
    round: "Lower Final",
    leftLabel: "Match 4 winner",
    rightLabel: "Upper Final loser",
    waiting: "Waiting for Lower Round 2 and the Upper Final",
    winnerGoes: "Grand Final",
    loserGoes: "Eliminated",
  },
  final: {
    slotKey: "final",
    kind: "final",
    matchNumber: 7,
    bestOf: FINAL_BEST_OF,
    label: "Match 7 · Grand Final",
    stage: "grand",
    round: "Grand Final",
    leftLabel: "Upper Final winner",
    rightLabel: "Lower Final winner",
    waiting: "Waiting for the Upper Final and Lower Final",
    winnerGoes: "Champion",
    loserGoes: "Runner-up",
  },
};

export function isPlayoffBookKind(kind: string | null | undefined) {
  return Boolean(
    kind && (PLAYOFF_BOOK_KINDS as readonly string[]).includes(kind),
  );
}

export function isBracketSlot(slotKey: string | null | undefined): slotKey is BracketSlot {
  return Boolean(slotKey && (BRACKET_SLOTS as readonly string[]).includes(slotKey));
}

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

export function eliminatedFromSeeds(seeds: GroupSeeds): NamedTeam[] {
  return [seeds.a4, seeds.b4];
}

export function initialPairings(seeds: GroupSeeds): Record<
  "adv" | "ub1" | "ub2",
  { left: NamedTeam; right: NamedTeam }
> {
  return {
    adv: { left: seeds.a3, right: seeds.b3 },
    ub1: { left: seeds.a1, right: seeds.b2 },
    ub2: { left: seeds.b1, right: seeds.a2 },
  };
}

export function unlockedPairings(
  seeds: GroupSeeds | null,
  results: Partial<Record<BracketSlot, SlotResult>>,
): Record<BracketSlot, SlotPairing> {
  const empty = (slot: BracketSlot): SlotPairing => ({
    left: null,
    right: null,
    leftLabel: BRACKET_META[slot].leftLabel,
    rightLabel: BRACKET_META[slot].rightLabel,
  });

  const out = Object.fromEntries(
    BRACKET_SLOTS.map((slot) => [slot, empty(slot)]),
  ) as Record<BracketSlot, SlotPairing>;

  if (seeds) {
    const first = initialPairings(seeds);
    out.adv = {
      ...out.adv,
      left: first.adv.left,
      right: first.adv.right,
    };
    out.ub1 = {
      ...out.ub1,
      left: first.ub1.left,
      right: first.ub1.right,
    };
    out.ub2 = {
      ...out.ub2,
      left: first.ub2.left,
      right: first.ub2.right,
    };
  }

  if (results.adv && results.ub1) {
    out.lb1 = {
      ...out.lb1,
      left: results.adv.winner,
      right: results.ub1.loser,
    };
  }
  if (results.lb1 && results.ub2) {
    out.lb2 = {
      ...out.lb2,
      left: results.lb1.winner,
      right: results.ub2.loser,
    };
  }
  if (results.ub1 && results.ub2) {
    out.uf = {
      ...out.uf,
      left: results.ub1.winner,
      right: results.ub2.winner,
    };
  }
  if (results.lb2 && results.uf) {
    out.lb_final = {
      ...out.lb_final,
      left: results.lb2.winner,
      right: results.uf.loser,
    };
  }
  if (results.uf && results.lb_final) {
    out.final = {
      ...out.final,
      left: results.uf.winner,
      right: results.lb_final.winner,
    };
  }

  return out;
}

export function pairingReady(pair: SlotPairing) {
  return Boolean(pair.left && pair.right);
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
  if (bySlot.has("adv") && bySlot.has("ub1") && bySlot.has("ub2")) {
    return { opened: false as const, created: [] as BracketSlot[] };
  }

  const first = initialPairings(seeds);
  const after = await lastGroupKickoff();
  const created: BracketSlot[] = [];
  let cursor = after;

  for (const slot of ["ub1", "ub2", "adv"] as const) {
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

  const dependents: BracketSlot[] = ["lb1", "lb2", "uf", "lb_final", "final"];
  for (const slot of dependents) {
    if (bySlot.has(slot)) continue;
    const pair = pairings[slot];
    if (!pair.left || !pair.right) continue;
    const afterTimes = [await lastGroupKickoff()];
    const prereqSlots: BracketSlot[] =
      slot === "lb1"
        ? ["adv", "ub1"]
        : slot === "lb2"
          ? ["lb1", "ub2"]
          : slot === "uf"
            ? ["ub1", "ub2"]
            : slot === "lb_final"
              ? ["lb2", "uf"]
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

  if (kind === "lb" && !(done("adv") && done("ub1"))) {
    throw new Error(
      "Lower bracket Match 3 unlocks after the Advancement Match and Upper Round 1 Match 1.",
    );
  }
  if (kind === "ub_final" && !(done("ub1") && done("ub2"))) {
    throw new Error(
      "The Upper Final unlocks after both Upper Round 1 matches are completed.",
    );
  }
  if (kind === "lb_final" && !(done("lb2") && done("uf"))) {
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
  const [groupA, groupB, complete] = await Promise.all([
    getGroupStandings("A"),
    getGroupStandings("B"),
    groupStageComplete(),
  ]);
  return {
    groupA,
    groupB,
    complete,
    seeds: complete ? seedsFromStandings(groupA, groupB) : null,
  };
}
