import assert from "node:assert/strict";
import { nextSeriesScore, planSeriesUpload } from "../src/lib/series-games";

const radiant = "radiant";
const dire = "dire";

assert.deepEqual(
  planSeriesUpload({
    bestOf: 1,
    status: "scheduled",
    radiantWins: 0,
    direWins: 0,
    matchId: "m1",
    storedScoreboards: 0,
  }),
  { kind: "bo1", matchId: "m1" },
);

assert.equal(
  planSeriesUpload({
    bestOf: 3,
    status: "scheduled",
    radiantWins: 1,
    direWins: 0,
    matchId: "g1",
    storedScoreboards: 1,
  }).kind,
  "append",
);

assert.equal(
  planSeriesUpload({
    bestOf: 3,
    status: "completed",
    radiantWins: 2,
    direWins: 0,
    matchId: "g2",
    storedScoreboards: 1,
  }).kind,
  "recover",
);

assert.equal(
  planSeriesUpload({
    bestOf: 3,
    status: "completed",
    radiantWins: 2,
    direWins: 0,
    matchId: "g2",
    storedScoreboards: 2,
  }).kind,
  "closed",
);

const base = {
  bestOf: 3,
  status: "scheduled",
  radiantWins: 1,
  direWins: 0,
  radiantTeamId: radiant,
  direTeamId: dire,
};

assert.deepEqual(
  nextSeriesScore({
    ...base,
    games: [{ winnerTeamId: radiant }, { winnerTeamId: dire }],
  }),
  { radiantWins: 1, direWins: 1, seriesOver: false },
);

assert.deepEqual(
  nextSeriesScore({
    ...base,
    games: [{ winnerTeamId: dire }, { winnerTeamId: dire }],
  }),
  { radiantWins: 0, direWins: 2, seriesOver: true },
);

assert.equal(
  nextSeriesScore({
    ...base,
    status: "completed",
    radiantWins: 2,
    direWins: 0,
    games: [{ winnerTeamId: dire }],
  }),
  null,
);

console.log("series-games checks passed");
