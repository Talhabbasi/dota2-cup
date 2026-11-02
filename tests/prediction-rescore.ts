import assert from "node:assert/strict";
import { correctedSeriesScore } from "../src/lib/predictions";

const radiant = "radiant";
const dire = "dire";

const bo1 = {
  status: "completed",
  bestOf: 1,
  radiantWins: 1,
  direWins: 0,
  radiantTeamId: radiant,
  direTeamId: dire,
};

assert.deepEqual(correctedSeriesScore(bo1, dire), {
  radiantWins: 0,
  direWins: 1,
});
assert.deepEqual(correctedSeriesScore(bo1, radiant), {
  radiantWins: 1,
  direWins: 0,
});
assert.equal(correctedSeriesScore(bo1, "other"), null);

assert.deepEqual(
  correctedSeriesScore(
    { ...bo1, status: "scheduled", radiantWins: 0, direWins: 0 },
    radiant,
  ),
  { radiantWins: 1, direWins: 0 },
);

const bo3 = {
  status: "completed",
  bestOf: 3,
  radiantWins: 2,
  direWins: 1,
  radiantTeamId: radiant,
  direTeamId: dire,
};

assert.deepEqual(correctedSeriesScore(bo3, dire), {
  radiantWins: 1,
  direWins: 2,
});
assert.deepEqual(correctedSeriesScore(bo3, radiant), {
  radiantWins: 2,
  direWins: 1,
});
assert.equal(
  correctedSeriesScore({ ...bo3, status: "scheduled", radiantWins: 1, direWins: 0 }, dire),
  null,
);

console.log("prediction rescore tests passed");
