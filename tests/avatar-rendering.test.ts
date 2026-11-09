import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { avatarSvg } from "../src/lib/avatar/portrait";
import { defaultAvatarConfig } from "../src/lib/avatar/defaults";

const base = defaultAvatarConfig();
async function pixels(config = base) {
  return sharp(Buffer.from(avatarSvg(config))).resize(512, 512).ensureAlpha().raw().toBuffer();
}
function region(data: Buffer, x: number, y: number, width: number, height: number) {
  return Buffer.concat(Array.from({ length: height }, (_, row) =>
    data.subarray(((y + row) * 512 + x) * 4, ((y + row) * 512 + x + width) * 4)));
}

test("every hairstyle has an opaque torso and a transparent exterior", async () => {
  for (const gender of ["male", "female"] as const) {
    for (const hairStyle of gender === "male" ? ["short", "spiky", "undercut"] : ["long-wavy", "bob", "ponytail"]) {
      const data = await pixels({ ...base, gender, hairStyle, clothingColor: "#1565C0" });
      for (let y = 430; y < 512; y++) for (let x = 150; x < 362; x++) {
        assert.equal(data[(y * 512 + x) * 4 + 3], 255, `${gender}/${hairStyle}: hole at ${x},${y}`);
      }
      assert.equal(data[3], 0);
    }
  }
});

test("white hair changes only hair and brows, not eyes, skin, or clothing", async () => {
  const dark = await pixels();
  const white = await pixels({ ...base, hairColor: "#F5F5F5" });
  for (const [x,y,w,h] of [[190,225,132,20], [240,245,32,30], [150,430,212,80]]) {
    assert.deepEqual(region(white,x,y,w,h), region(dark,x,y,w,h));
  }
  assert.notDeepEqual(region(white,220,105,50,25), region(dark,220,105,50,25));
});

test("beards share a stable position across male hairstyles and leave the neck clear", async () => {
  for (const beardStyle of ["stubble", "full", "goatee"]) {
    const reference = await pixels({ ...base, beardStyle });
    for (const hairStyle of ["short", "undercut"]) {
      const data = await pixels({ ...base, hairStyle, beardStyle });
      assert.deepEqual(region(data,185,275,142,70), region(reference,185,275,142,70));
    }
    assert.deepEqual(region(reference,215,350,80,25), region(await pixels(),215,350,80,25));
  }
});


test("all build and outfit combinations have complete torsos and visibly different widths", async () => {
  for (const gender of ["male", "female"] as const) {
    const widths: number[] = [];
    for (const bodyType of ["slim", "regular", "broad"] as const) {
      for (const clothing of ["tshirt", "hoodie", "jersey"]) {
        const data = await pixels({ ...base, gender, bodyType, clothing });
        for (let y = 430; y < 512; y++) for (let x = 180; x < 332; x++) {
          assert.equal(data[(y*512+x)*4+3], 255, `${gender}/${bodyType}/${clothing}: torso hole`);
        }
        if (clothing === "tshirt") {
          widths.push(Array.from({ length: 512 }, (_, x) => data[(490*512+x)*4+3]).filter(a => a > 240).length);
        }
      }
    }
    assert.ok(widths[1] > widths[0] + 30);
    assert.ok(widths[2] > widths[1] + 30);
  }
});
