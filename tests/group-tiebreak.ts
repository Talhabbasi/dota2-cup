import assert from "node:assert/strict";
import { compareGroupStandings } from "../src/lib/season-data";
import type { GroupStandingRow } from "../src/lib/group-stage-schedule";

function row(
  name: string,
  points: number,
  kills: number,
  conceded = 0,
): GroupStandingRow {
  return {
    id: name,
    name,
    played: 4,
    wins: points,
    losses: 4 - points,
    points,
    kills,
    conceded,
  };
}

const ordered = [row("Ash", 3, 169, 203), row("Dandy", 3, 161, 149), row("Grand_Master", 3, 101, 137), row("Frantic", 1, 160, 149)]
  .sort(compareGroupStandings)
  .map((team) => team.name);

assert.deepEqual(ordered, ["Ash", "Dandy", "Grand_Master", "Frantic"]);

const sameKills = [row("B", 3, 100, 80), row("A", 3, 100, 120)].sort(compareGroupStandings);
assert.deepEqual(
  sameKills.map((team) => team.name),
  ["B", "A"],
);

console.log("group tiebreak ok");
