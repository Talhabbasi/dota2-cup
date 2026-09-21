import {
  BRACKET_META,
  eliminatedFromSeeds,
  initialPairings,
  nextPlayoffKickoff,
  seedsFromStandings,
  unlockedPairings,
  type BracketSlot,
  type GroupSeeds,
  type NamedTeam,
  type SlotResult,
} from "../src/lib/playoff-bracket";
import {
  isAllowedPlayoffKickoff,
  isGroupNightHour,
  isPlayoffWindowHour,
  kickoffFromMatchNight,
  parseMatchNightHour,
  parseWeekendDate,
} from "../src/lib/schedule-crud";
import { localToUtc } from "../src/lib/schedule";
import type { GroupStandingRow } from "../src/lib/group-stage-schedule";

function team(id: string, name: string): NamedTeam {
  return { id, name };
}

function standing(
  id: string,
  name: string,
  wins: number,
): GroupStandingRow {
  return {
    id,
    name,
    played: 3,
    wins,
    losses: 3 - wins,
    points: wins,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameTeam(a: NamedTeam | null, b: NamedTeam) {
  return a?.id === b.id;
}

function idsOf(pair: { left: NamedTeam | null; right: NamedTeam | null }) {
  return new Set([pair.left?.id, pair.right?.id].filter(Boolean));
}

const chessman = team("a-chess", "Team Chessman");
const lala = team("a-lala", "Team Lala");
const xtc = team("a-xtc", "Team XTC");
const yona = team("a-yona", "Team Yona");
const ash = team("b-ash", "Team Ash");
const gm = team("b-gm", "Team Grand_Master");
const saif = team("b-saif", "Team Saif");
const stoic = team("b-stoic", "Team Stoic");

const rankingA = [xtc, chessman, lala, yona];
const rankingB = [saif, ash, gm, stoic];

const groupA = rankingA.map((row, index) => standing(row.id, row.name, 3 - index));
const groupB = rankingB.map((row, index) => standing(row.id, row.name, 3 - index));

const seeds = seedsFromStandings(groupA, groupB);
assert(seeds, "Seeds should resolve once every team has played 3 games");

assert(seeds.a1.name === "Team XTC", `A1 should be XTC, got ${seeds.a1.name}`);
assert(seeds.a2.name === "Team Chessman", `A2 should be Chessman, got ${seeds.a2.name}`);
assert(seeds.a3.name === "Team Lala", `A3 should be Lala, got ${seeds.a3.name}`);
assert(seeds.a4.name === "Team Yona", `A4 should be Yona, got ${seeds.a4.name}`);
assert(seeds.b1.name === "Team Saif", `B1 should be Saif, got ${seeds.b1.name}`);
assert(seeds.b2.name === "Team Ash", `B2 should be Ash, got ${seeds.b2.name}`);
assert(seeds.b3.name === "Team Grand_Master", `B3 should be Grand_Master, got ${seeds.b3.name}`);
assert(seeds.b4.name === "Team Stoic", `B4 should be Stoic, got ${seeds.b4.name}`);

const first = initialPairings(seeds);
assert(sameTeam(first.ub1.left, xtc) && sameTeam(first.ub1.right, ash), "Match 1 must be A1 vs B2 (XTC vs Ash)");
assert(sameTeam(first.ub2.left, saif) && sameTeam(first.ub2.right, chessman), "Match 2 must be B1 vs A2 (Saif vs Chessman)");

const out = eliminatedFromSeeds(seeds).map((row) => row.id);
assert(out.includes(yona.id) && out.includes(stoic.id), "4th-place Yona and Stoic must be eliminated");

const empty = unlockedPairings(seeds, {});
assert(sameTeam(empty.lb1.left, lala) && !empty.lb1.right, "Group A 3rd waits for the Match 1 loser");
assert(sameTeam(empty.lb2.left, gm) && !empty.lb2.right, "Group B 3rd waits for the Match 2 loser");
assert(!empty.uf.left && !empty.uf.right, "Upper Final must wait for both Upper Round 1 matches");
assert(!empty.final.left && !empty.final.right, "Grand Final must wait for both finals");

function result(winner: NamedTeam, loser: NamedTeam): SlotResult {
  return { winner, loser };
}

const afterUb1 = unlockedPairings(seeds, {
  ub1: result(xtc, ash),
});
assert(
  sameTeam(afterUb1.lb1.left, lala) && sameTeam(afterUb1.lb1.right, ash),
  "Lower Round 1 Match 3 must be Group A 3rd vs Match 1 loser",
);
assert(!afterUb1.lb2.right, "Match 4 still needs Match 2");
assert(!afterUb1.uf.left, "Upper Final still needs Match 2");

const afterUb = unlockedPairings(seeds, {
  ub1: result(xtc, ash),
  ub2: result(chessman, saif),
});
assert(
  sameTeam(afterUb.lb2.left, gm) && sameTeam(afterUb.lb2.right, saif),
  "Lower Round 1 Match 4 must be Group B 3rd vs Match 2 loser",
);
assert(
  sameTeam(afterUb.uf.left, xtc) && sameTeam(afterUb.uf.right, chessman),
  "Upper Final must be Match 1 winner vs Match 2 winner",
);
assert(!afterUb.lb3.left, "Lower Round 2 still needs both Lower Round 1 matches");

const afterLb = unlockedPairings(seeds, {
  ub1: result(xtc, ash),
  ub2: result(chessman, saif),
  lb1: result(ash, lala),
  lb2: result(gm, saif),
});
assert(
  sameTeam(afterLb.lb3.left, ash) && sameTeam(afterLb.lb3.right, gm),
  "Lower Round 2 must be the two Lower Round 1 winners",
);

const afterAll: Partial<Record<BracketSlot, SlotResult>> = {
  ub1: result(xtc, ash),
  ub2: result(chessman, saif),
  lb1: result(ash, lala),
  lb2: result(gm, saif),
  lb3: result(ash, gm),
  uf: result(xtc, chessman),
  lb_final: result(ash, chessman),
};
const almost = unlockedPairings(seeds, {
  ub1: afterAll.ub1,
  ub2: afterAll.ub2,
  lb1: afterAll.lb1,
  lb2: afterAll.lb2,
  lb3: afterAll.lb3,
  uf: afterAll.uf,
});
assert(
  sameTeam(almost.lb_final.left, ash) && sameTeam(almost.lb_final.right, chessman),
  "Lower Final must be Match 6 winner vs Upper Final loser",
);
assert(!almost.final.left, "Grand Final must wait for the Lower Final");

const finals = unlockedPairings(seeds, afterAll);
assert(
  sameTeam(finals.final.left, xtc) && sameTeam(finals.final.right, ash),
  "Grand Final must be Upper Final winner vs Lower Final winner",
);

for (const slot of ["ub1", "ub2", "lb1", "lb2", "lb3", "uf", "lb_final", "final"] as const) {
  const ids = idsOf(finals[slot]);
  assert(!ids.has(yona.id), `Eliminated A4 must not appear in ${slot}`);
  assert(!ids.has(stoic.id), `Eliminated B4 must not appear in ${slot}`);
}

assert(BRACKET_META.final.bestOf === 3, "Grand Final must be Bo3");
for (const slot of ["ub1", "ub2", "lb1", "lb2", "lb3", "uf", "lb_final"] as const) {
  assert(BRACKET_META[slot].bestOf === 1, `${slot} must be Bo1`);
}

const altA = [lala, yona, chessman, xtc].map((row, index) =>
  standing(row.id, row.name, 3 - index),
);
const altB = [stoic, gm, ash, saif].map((row, index) =>
  standing(row.id, row.name, 3 - index),
);
const alt = seedsFromStandings(altA, altB) as GroupSeeds;
const altFirst = initialPairings(alt);
assert(sameTeam(altFirst.ub1.left, lala) && sameTeam(altFirst.ub1.right, gm), "A different table must still seed A1 vs B2");
assert(sameTeam(altFirst.ub2.left, stoic) && sameTeam(altFirst.ub2.right, yona), "A different table must still seed B1 vs A2");
const altEmpty = unlockedPairings(alt, {});
assert(sameTeam(altEmpty.lb1.left, chessman), "A different table must still seat A3 vs the Match 1 loser");
assert(sameTeam(altEmpty.lb2.left, ash), "A different table must still seat B3 vs the Match 2 loser");

assert(parseMatchNightHour("10am") === 10, "10am should parse");
assert(parseMatchNightHour("15") === 15, "3pm should parse");
assert(parseMatchNightHour("3") === 3, "3am should parse");
assert(isPlayoffWindowHour(10) && isPlayoffWindowHour(22) && isPlayoffWindowHour(3), "Playoff window includes 10am, 10pm, 3am");
assert(!isPlayoffWindowHour(4), "4am is outside the playoff window");
assert(isGroupNightHour(4) && isGroupNightHour(22), "Group stage still allows 10pm–6am");

const saturday = parseWeekendDate("2026-09-26");
assert(saturday.dow === 6, "2026-09-26 is a Saturday");
try {
  parseWeekendDate("2026-09-25");
  throw new Error("Friday should be rejected");
} catch (error) {
  assert(
    error instanceof Error && /Friday/.test(error.message),
    "Weekdays must be rejected",
  );
}

const sat10am = kickoffFromMatchNight(saturday, 10);
const sat3am = kickoffFromMatchNight(saturday, 3);
assert(isAllowedPlayoffKickoff(sat10am), "Saturday 10:00 AM must be allowed");
assert(isAllowedPlayoffKickoff(sat3am), "Saturday night 3:00 AM (Sunday morning) must be allowed");
assert(isAllowedPlayoffKickoff(kickoffFromMatchNight(saturday, 22)), "Saturday 10:00 PM must be allowed");

const sunday = parseWeekendDate("2026-09-27");
assert(isAllowedPlayoffKickoff(kickoffFromMatchNight(sunday, 10)), "Sunday 10:00 AM must be allowed");
assert(isAllowedPlayoffKickoff(kickoffFromMatchNight(sunday, 3)), "Sunday night 3:00 AM must be allowed");

const fridayMorning = localToUtc(2026, 8, 25, 10, 0, 5);
assert(!isAllowedPlayoffKickoff(fridayMorning), "Friday 10:00 AM must be rejected");
const monday4 = localToUtc(2026, 8, 28, 4, 0, 5);
assert(!isAllowedPlayoffKickoff(monday4), "Monday 4:00 AM must be rejected");

const slot = nextPlayoffKickoff({
  after: localToUtc(2026, 8, 21, 4, 0, 5),
  occupied: [],
  teamBusy: [],
  teamIds: [xtc.id, ash.id],
});
assert(isAllowedPlayoffKickoff(slot), "Auto-picked playoff time must stay inside the weekend window");

const clustered = nextPlayoffKickoff({
  after: sat10am,
  occupied: [sat10am],
  teamBusy: [{ teamId: xtc.id, at: sat10am }],
  teamIds: [saif.id, chessman.id],
});
assert(
  clustered.getTime() >= sat10am.getTime() + 60 * 60 * 1000,
  "The next match must leave a buffer after the previous kickoff",
);

console.log("playoff bracket tests passed");
