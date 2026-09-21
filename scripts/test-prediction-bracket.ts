import { seedsFromStandings, type GroupSeeds } from "../src/lib/playoff-bracket";
import { applyPicksToResults, pickemSlots } from "../src/lib/prediction-bracket";
import type { GroupStandingRow } from "../src/lib/group-stage-schedule";
import type { NamedTeam } from "../src/lib/playoff-tree";

function team(id: string, name: string): NamedTeam {
  return { id, name };
}

function standing(id: string, name: string, wins: number): GroupStandingRow {
  return { id, name, played: 3, wins, losses: 3 - wins, points: wins };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const a1 = team("a1", "Lala");
const a2 = team("a2", "Ash");
const a3 = team("a3", "Danu");
const a4 = team("a4", "Chessman");
const b1 = team("b1", "Stoic");
const b2 = team("b2", "Saif");
const b3 = team("b3", "Toji");
const b4 = team("b4", "GM");

const seeds = seedsFromStandings(
  [a1, a2, a3, a4].map((row, i) => standing(row.id, row.name, 3 - i)),
  [b1, b2, b3, b4].map((row, i) => standing(row.id, row.name, 3 - i)),
) as GroupSeeds;

const afterOpeners = applyPicksToResults(seeds, {}, { ub1: a1.id, ub2: b1.id });
assert(afterOpeners.ub1?.winner.id === a1.id, "A1 should win Match 1 in this pick");
assert(afterOpeners.ub1?.loser.id === b2.id, "B2 should drop from Match 1");
assert(afterOpeners.ub2?.loser.id === a2.id, "A2 should drop from Match 2");

const slots = pickemSlots(
  seeds,
  {},
  { ub1: a1.id, ub2: b1.id, lb1: a3.id, lb2: a2.id },
  new Set(),
  false,
);
const lb1 = slots.find((row) => row.slotKey === "lb1");
const uf = slots.find((row) => row.slotKey === "uf");
assert(lb1?.right?.id === b2.id, "Match 1 loser should land on A3's lower match");
assert(uf?.left?.id === a1.id && uf?.right?.id === b1.id, "Upper Final should be the two Match 1/2 winners");

console.log("prediction bracket tests passed");
