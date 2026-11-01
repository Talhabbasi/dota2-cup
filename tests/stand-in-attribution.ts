import assert from "node:assert/strict";
import {
  classifySeatAppearance,
  insightGroupForSeat,
  plannedStandInFlag,
  standInInsightName,
} from "../src/lib/stand-in";
import { resolveScoreboardSeat, type RosterPlayer } from "../src/lib/scoreboard-shot";

let passed = 0;
function check(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

const teamA = "team-a";
const teamB = "team-b";
const teamC = "team-c";
const invoker = "player-invoker";

function seat(input: {
  representedTeamId: string;
  representedTeamName: string;
  kills: number;
  deaths: number;
  assists: number;
  asStandIn?: boolean;
  originalTeamId?: string | null;
}) {
  return {
    playerId: invoker,
    playerName: "Invoker",
    unknown: false,
    asStandIn: input.asStandIn ?? false,
    originalTeamId: input.originalTeamId === undefined ? teamA : input.originalTeamId,
    originalTeamName: "Team A",
    representedTeamId: input.representedTeamId,
    representedTeamName: input.representedTeamName,
    kills: input.kills,
    deaths: input.deaths,
    assists: input.assists,
  };
}

function totals(
  rows: ReturnType<typeof seat>[],
) {
  const map = new Map<
    string,
    { name: string; kind: string; kills: number; deaths: number; assists: number; games: number }
  >();
  for (const row of rows) {
    const group = insightGroupForSeat(row);
    if (!group) continue;
    const cur = map.get(group.key) ?? {
      name: group.name,
      kind: group.kind,
      kills: 0,
      deaths: 0,
      assists: 0,
      games: 0,
    };
    cur.kills += row.kills;
    cur.deaths += row.deaths;
    cur.assists += row.assists;
    cur.games += 1;
    cur.name = group.name;
    map.set(group.key, cur);
  }
  return [...map.values()];
}

const own = seat({
  representedTeamId: teamA,
  representedTeamName: "Team A",
  kills: 15,
  deaths: 4,
  assists: 10,
  asStandIn: true,
});
assert.equal(
  classifySeatAppearance(own),
  "regular",
  "own team stays regular even when a leaked flag says stand-in",
);
check("registered player on their own team is regular");

const forB = seat({
  representedTeamId: teamB,
  representedTeamName: "Team B",
  kills: 20,
  deaths: 6,
  assists: 12,
});
assert.equal(classifySeatAppearance(forB), "standin");
check("same player for another team is a stand-in for that match");

const backHome = seat({
  representedTeamId: teamA,
  representedTeamName: "Team A",
  kills: 10,
  deaths: 3,
  assists: 8,
});
assert.equal(classifySeatAppearance(backHome), "regular");
check("returning to the original team is regular");

const forC = seat({
  representedTeamId: teamC,
  representedTeamName: "Team C",
  kills: 8,
  deaths: 5,
  assists: 9,
});
const forBAgain = seat({
  representedTeamId: teamB,
  representedTeamName: "Team B",
  kills: 4,
  deaths: 1,
  assists: 2,
});

const grouped = totals([own, forB, backHome, forC, forBAgain]);
assert.equal(grouped.length, 3);
const regular = grouped.find((row) => row.kind === "roster");
const standB = grouped.find((row) => row.name === standInInsightName("Invoker", "Team B"));
const standC = grouped.find((row) => row.name === standInInsightName("Invoker", "Team C"));
assert.ok(regular);
assert.equal(regular.kills, 25);
assert.equal(regular.deaths, 7);
assert.equal(regular.assists, 18);
assert.equal(regular.name, "Invoker");
assert.ok(standB);
assert.equal(standB.kills, 24);
assert.equal(standB.deaths, 7);
assert.equal(standB.assists, 14);
assert.equal(standB.games, 2);
assert.ok(standC);
assert.equal(standC.kills, 8);
check("regular kills exclude stand-ins and each stand-in team is one row");

const edited = totals([
  own,
  seat({
    representedTeamId: teamB,
    representedTeamName: "Team B",
    kills: 5,
    deaths: 1,
    assists: 1,
  }),
]);
assert.equal(edited.find((row) => row.kind === "roster")?.kills, 15);
assert.equal(
  edited.find((row) => row.kind === "standin")?.kills,
  5,
);
check("replacing a match result does not double-count");

const flag = plannedStandInFlag({
  playerId: invoker,
  originalTeamId: teamA,
  representedTeamId: teamB,
});
assert.equal(flag, true);
assert.equal(
  plannedStandInFlag({
    playerId: invoker,
    originalTeamId: teamA,
    representedTeamId: teamB,
    asStandIn: true,
  }),
  true,
);
assert.equal(
  plannedStandInFlag({
    playerId: invoker,
    originalTeamId: teamA,
    representedTeamId: teamA,
    asStandIn: true,
  }),
  false,
);
assert.equal(
  plannedStandInFlag({
    playerId: invoker,
    originalTeamId: null,
    representedTeamId: teamB,
    asStandIn: false,
  }),
  null,
);
check("correction is idempotent and does not invent a team for an unknown roster");

const roster: RosterPlayer[] = [
  {
    id: invoker,
    steamName: "Invoker",
    steam32: 1,
    teamId: teamA,
    labels: ["invoker"],
  },
  {
    id: "other-invoker",
    steamName: "Invoker",
    steam32: 2,
    teamId: teamC,
    labels: ["invoker"],
  },
  {
    id: "shadow",
    steamName: "Shadow",
    steam32: 3,
    teamId: teamB,
    labels: ["shadow"],
  },
];

const standInRead = resolveScoreboardSeat(
  "Invoker",
  roster.filter((player) => player.id !== "other-invoker"),
  teamB,
  new Set(),
  true,
);
assert.equal(standInRead.player?.id, invoker);
assert.equal(standInRead.asStandIn, true);
check("screenshot links the registered player on the team they represented");

const collision = resolveScoreboardSeat("Invoker", roster, teamB, new Set(), false);
assert.equal(collision.player, null);
assert.equal(collision.asStandIn, false);
check("two players with the same name are not merged");

const historic = classifySeatAppearance({
  playerId: invoker,
  originalTeamId: teamA,
  representedTeamId: teamA,
  asStandIn: false,
});
const laterClub = classifySeatAppearance({
  playerId: invoker,
  originalTeamId: teamB,
  representedTeamId: teamB,
  asStandIn: false,
});
assert.equal(historic, "regular");
assert.equal(laterClub, "regular");
check("each match uses that season roster, not one current team");

const ownRead = resolveScoreboardSeat("Invoker", roster, teamA, new Set(), true);
assert.equal(ownRead.player?.id, invoker);
assert.equal(ownRead.asStandIn, false);
check("a remembered stand-in name still counts as regular on their own team");

console.log(`${passed} checks passed`);
