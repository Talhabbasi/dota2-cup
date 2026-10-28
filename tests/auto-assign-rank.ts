import assert from "node:assert/strict";
import { MEDALS, PUBG_MEDALS } from "../src/lib/constants";
import {
  AUTO_ASSIGN_CAP,
  buildBalancedAssignment,
  rankScore,
  type BalancePlayer,
  type BalanceTeam,
} from "../src/lib/auto-assign-balance";

let passed = 0;
function check(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

const dotaOrder = [
  "immortal",
  "divine",
  "ancient",
  "legend",
  "archon",
  "crusader",
  "guardian",
  "herald",
  "uncalibrated",
];
const pubgOrder = [
  "survivor",
  "master",
  "diamond",
  "crystal",
  "platinum",
  "gold",
  "silver",
  "bronze",
  "unranked",
];

assert.deepEqual([...MEDALS], dotaOrder);
assert.deepEqual([...PUBG_MEDALS], pubgOrder);
for (let i = 0; i < dotaOrder.length; i++) {
  assert.equal(rankScore(dotaOrder[i]), 8 - i);
  assert.equal(rankScore(dotaOrder[i]!.toUpperCase()), 8 - i);
}
for (let i = 0; i < pubgOrder.length; i++) {
  assert.equal(rankScore(pubgOrder[i]), 8 - i);
}
assert.equal(rankScore("  Divine "), 7);
assert.equal(rankScore(" Survivor "), 8);
assert.equal(rankScore(null), null);
assert.equal(rankScore(""), null);
assert.equal(rankScore("ancient-5"), null);
check("dota and pubg medals are one step apart, unknown medals are rejected");

function players(medals: string[], prefix: string): BalancePlayer[] {
  return medals.map((medal, index) => ({
    id: `${prefix}-${index}`,
    mmr: rankScore(medal)!,
  }));
}

function finish(
  teams: BalanceTeam[],
  pool: BalancePlayer[],
  placements: { playerId: string; teamId: string }[],
) {
  const mmr = new Map(pool.map((player) => [player.id, player.mmr]));
  const added = new Map<string, number[]>();
  for (const team of teams) added.set(team.id, []);
  const seen = new Set<string>();
  for (const row of placements) {
    assert.equal(seen.has(row.playerId), false, "player assigned twice");
    seen.add(row.playerId);
    assert.ok(mmr.has(row.playerId), "unknown player");
    const bucket = added.get(row.teamId);
    assert.ok(bucket, "unknown team");
    bucket.push(mmr.get(row.playerId)!);
  }
  return teams.map((team) => {
    const extra = added.get(team.id)!;
    const count = team.count + extra.length;
    assert.ok(count <= AUTO_ASSIGN_CAP, `${team.id} went past ${AUTO_ASSIGN_CAP}`);
    const ranked = team.ranked + extra.length;
    const total = team.total + extra.reduce((sum, value) => sum + value, 0);
    return {
      id: team.id,
      count,
      added: extra.length,
      avg: ranked > 0 ? total / ranked : null,
    };
  });
}

function slots(teams: BalanceTeam[]) {
  return teams.reduce(
    (sum, team) => sum + Math.max(0, AUTO_ASSIGN_CAP - team.count),
    0,
  );
}

function runCup(label: string, highMedal: string, lowMedal: string, poolMedals: string[]) {
  const teams: BalanceTeam[] = [
    { id: "high", count: 4, ranked: 4, total: rankScore(highMedal)! * 4 },
    { id: "low", count: 4, ranked: 4, total: rankScore(lowMedal)! * 4 },
    { id: "full", count: 5, ranked: 5, total: rankScore(highMedal)! * 5 },
    { id: "empty", count: 0, ranked: 0, total: 0 },
  ];
  const pool = players(poolMedals, label);
  const openSlots = slots(teams);
  const spreads: number[] = [];
  const signatures = new Set<string>();
  for (let seed = 1; seed <= 25; seed++) {
    const result = buildBalancedAssignment(pool, teams, seed);
    const rows = finish(teams, pool, result.placements);
    assert.equal(result.placements.length, Math.min(pool.length, openSlots));
    assert.equal(rows.find((team) => team.id === "full")!.added, 0);
    assert.equal(Number.isFinite(result.spread), true);
    spreads.push(result.spread);
    signatures.add(
      result.placements
        .map((row) => `${row.playerId}:${row.teamId}`)
        .sort()
        .join("|"),
    );
    const high = rows.find((team) => team.id === "high")!;
    const low = rows.find((team) => team.id === "low")!;
    assert.ok(high.avg != null && low.avg != null);
    assert.ok(
      high.avg - low.avg < rankScore(highMedal)! - rankScore(lowMedal)!,
      `${label} left the strong team much stronger than the weak team`,
    );
  }
  const best = Math.min(...spreads);
  const worst = Math.max(...spreads);
  assert.ok(worst - best <= 1, `${label} regenerate spread drifted ${worst - best}`);
  console.log(
    `${label}: seeds 1-25, spread ${best.toFixed(2)}–${worst.toFixed(2)}, distinct draws ${signatures.size}`,
  );
  check(`${label} fills only open slots and stays on the medal ladder`);
}

runCup("dota", "immortal", "herald", [
  "immortal",
  "divine",
  "ancient",
  "legend",
  "archon",
  "crusader",
  "guardian",
  "herald",
  "uncalibrated",
]);
runCup("pubg", "survivor", "bronze", [
  "survivor",
  "master",
  "diamond",
  "crystal",
  "platinum",
  "gold",
  "silver",
  "bronze",
  "unranked",
]);

const directedTeams: BalanceTeam[] = [
  { id: "immortals", count: 4, ranked: 4, total: 32 },
  { id: "heralds", count: 4, ranked: 4, total: 4 },
];
const directedPlayers = players(["immortal", "herald"], "pair");
for (let seed = 1; seed <= 20; seed++) {
  const result = buildBalancedAssignment(directedPlayers, directedTeams, seed);
  const byPlayer = new Map(result.placements.map((row) => [row.playerId, row.teamId]));
  assert.equal(byPlayer.get("pair-0"), "heralds");
  assert.equal(byPlayer.get("pair-1"), "immortals");
}
check("an immortal fills the herald team, not the immortal team");

const emptyTeams: BalanceTeam[] = [
  { id: "a", count: 0, ranked: 0, total: 0 },
  { id: "b", count: 0, ranked: 0, total: 0 },
];
const handful = players(["divine", "archon", "herald", "ancient"], "empty");
const emptyResult = buildBalancedAssignment(handful, emptyTeams, 7);
const emptyRows = finish(emptyTeams, handful, emptyResult.placements);
assert.equal(emptyResult.placements.length, 4);
assert.ok(emptyRows.every((team) => team.avg == null || team.avg > 0));
assert.equal(Number.isFinite(emptyResult.spread), true);
check("empty teams do not divide by zero");

const noRoom: BalanceTeam[] = [{ id: "full", count: 5, ranked: 5, total: 30 }];
const blocked = buildBalancedAssignment(players(["legend"], "x"), noRoom, 3);
assert.equal(blocked.placements.length, 0);
check("a full team receives nobody");

console.log(`\n${passed} checks passed`);
