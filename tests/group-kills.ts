import assert from "node:assert/strict";
import {
  applyGroupFixtures,
  groupFixtureRosterKills,
} from "../src/lib/season-data";

const invoker = "invoker";
const stoic = "stoic";
const dandy = "dandy";

const roster = new Map<string, string | null>([
  ["hurr", stoic],
  ["stoic-player", stoic],
  ["invoker-player", invoker],
  ["prodandy", dandy],
]);

// Sides saved backwards: Stoic's players are marked radiant, Invoker is dire.
// Prodandy stood in. His kills must not land on either club.
const swapped = groupFixtureRosterKills(
  { radiantTeamId: invoker, direTeamId: stoic },
  [
    { side: "radiant", kills: 18, playerId: "hurr" },
    { side: "radiant", kills: 12, playerId: "stoic-player" },
    { side: "dire", kills: 8, playerId: "invoker-player" },
    { side: "dire", kills: 2, playerId: "prodandy", asStandIn: true },
  ],
  roster,
);

assert.deepEqual(swapped, {
  radiantKills: 8,
  direKills: 30,
  radiantStandIn: 2,
  direStandIn: 0,
});

const table = applyGroupFixtures(
  [
    { id: invoker, name: "Invoker" },
    { id: stoic, name: "Stoic" },
  ],
  [
    {
      radiantTeamId: invoker,
      direTeamId: stoic,
      radiantWins: 0,
      direWins: 1,
      match: {
        winnerTeamId: stoic,
        players: [
          { side: "radiant", kills: 18, playerId: "hurr" },
          { side: "radiant", kills: 12, playerId: "stoic-player" },
          { side: "dire", kills: 8, playerId: "invoker-player" },
          { side: "dire", kills: 2, playerId: "prodandy", asStandIn: true },
        ],
      },
    },
  ],
  roster,
);

const byName = new Map(table.map((row) => [row.name, row]));
assert.equal(byName.get("Invoker")?.kills, 8);
assert.equal(byName.get("Invoker")?.standInKills, 2);
assert.equal(byName.get("Stoic")?.kills, 30);
assert.equal(byName.get("Stoic")?.standInKills, 0);
assert.equal(byName.get("Invoker")?.points, 0);
assert.equal(byName.get("Stoic")?.points, 1);

console.log("group roster kills ok");
