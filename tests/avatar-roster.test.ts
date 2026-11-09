import assert from "node:assert/strict";
import { test } from "node:test";
import { generatedAvatar, rosterAvatar, teamKitsFor } from "../src/lib/avatar/roster";
import { defaultAvatarConfig, parseAvatarConfig } from "../src/lib/avatar/defaults";

test("generated characters are stable, varied, and valid saved configurations", () => {
  const avatars = Array.from({length: 30}, (_, n) => generatedAvatar(`player-${n}`));
  assert.equal(new Set(avatars.map(a => JSON.stringify(a))).size, 30);
  avatars.forEach((avatar, n) => {
    assert.deepEqual(avatar, generatedAvatar(`player-${n}`));
    assert.deepEqual(parseAvatarConfig(JSON.stringify(avatar)), avatar);
  });
});

test("team uniform colors cover every clothing style without changing personal identity", () => {
  for (const clothing of ["tshirt", "hoodie", "jersey"]) {
    const personal = { ...defaultAvatarConfig("female"), bodyType: "broad" as const,
      hairStyle: "bob", hairColor: "#C2185B", clothing, clothingColor: "#C62828" };
    const saved = JSON.stringify(personal);
    const kit = teamKitsFor(["team-a"]).get("team-a")!;
    const roster = rosterAvatar("p1", saved, kit);
    assert.deepEqual(roster, { ...personal, clothing: kit.clothing, clothingColor: kit.color });
    assert.deepEqual(rosterAvatar("p1", saved), personal);
    assert.equal(JSON.stringify(personal), saved);
  }
});

test("default and customized members share team colors across roster order and transfers", () => {
  const ids = ["one", "two", "three", "four", "five"];
  const kits = teamKitsFor(["team-a", "team-b"]);
  const kitA = kits.get("team-a")!;
  const kitB = kits.get("team-b")!;
  assert.notEqual(kitA.color, kitB.color);
  for (const id of ids) {
    assert.equal(rosterAvatar(id, "", kitA).clothingColor, kitA.color);
    assert.equal(rosterAvatar(id, "", kitA).clothing, "jersey");
    assert.deepEqual(rosterAvatar(id, "", kitA), rosterAvatar(id, "bad JSON", kitA));
    const moved = rosterAvatar(id, "", kitB);
    assert.equal(moved.clothingColor, kitB.color);
    assert.deepEqual({ ...moved, clothingColor: "" }, { ...rosterAvatar(id, "", kitA), clothingColor: "" });
  }
  assert.deepEqual(ids.map(id => rosterAvatar(id, "", kitA)),
    [...ids].reverse().map(id => rosterAvatar(id, "", kitA)).reverse());
});
