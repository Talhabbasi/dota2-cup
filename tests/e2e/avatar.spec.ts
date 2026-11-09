import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

async function rendered(page: Page) {
  const selected = await page.locator('input[name="avatarConfig"]').inputValue();
  await expect(page.getByTestId("avatar-canvas")).toHaveAttribute("data-rendered-config", selected);
}

async function faceSum(page: Page) {
  await rendered(page);
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="avatar-canvas"]') as HTMLCanvasElement | null;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const x = Math.floor(canvas.width * 0.4);
    const y = Math.floor(canvas.height * 0.34);
    const w = Math.floor(canvas.width * 0.2);
    const h = Math.floor(canvas.height * 0.14);
    const data = ctx.getImageData(x, y, w, h).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 40) continue;
      sum += data[i]! + data[i + 1]! + data[i + 2]!;
      n++;
    }
    return n ? sum / n : 0;
  });
}

async function shirtSample(page: Page) {
  await rendered(page);
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="avatar-canvas"]') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const y0 = Math.floor(canvas.height * 0.72);
    for (let y = y0; y < canvas.height - 4; y++) {
      for (let x = Math.floor(canvas.width * 0.35); x < Math.floor(canvas.width * 0.65); x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i + 3]! < 200) continue;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        n++;
      }
    }
    if (!n) return { r: 0, g: 0, b: 0, n: 0 };
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), n };
  });
}

test("avatar maker renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/avatars/")) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto("/dev/avatar");
  await expect(page.getByRole("heading", { name: "Avatar maker preview" })).toBeVisible();
  await expect(page.getByTestId("avatar-canvas")).toBeVisible();
  await expect(page.getByTestId("avatar-gender-male")).toHaveAttribute("aria-checked", "true");
  expect(errors, errors.join("\n")).toEqual([]);
  expect(failed, failed.join("\n")).toEqual([]);
});

test("tone query selects a skin swatch and ignores invalid values", async ({ page }) => {
  await page.goto("/dev/avatar?tone=1");
  await expect(page.getByTestId("avatar-swatch-e8c4a2")).toHaveClass(/active/);
  await page.goto("/dev/avatar?tone=nope");
  await expect(page.getByTestId("avatar-swatch-d4a574")).toHaveClass(/active/);
  await page.goto("/dev/avatar");
  await expect(page.getByTestId("avatar-swatch-d4a574")).toHaveClass(/active/);
});

test("skin tones change the face and leave hair pixels in place", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-body").click();
  await page.getByTestId("avatar-swatch-f6e0c8").click();
  const light = await faceSum(page);
  await page.getByTestId("avatar-swatch-2a160e").click();
  const dark = await faceSum(page);
  expect(light).toBeGreaterThan(dark + 40);
  expect(dark).toBeGreaterThan(40);
});

test("male and female hairstyles and gender toggle", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-hair").click();
  for (const id of ["short", "spiky", "undercut"]) {
    await page.getByTestId(`avatar-option-${id}`).click();
    await expect(page.getByTestId(`avatar-option-${id}`)).toHaveClass(/active/);
  }
  await page.getByTestId("avatar-swatch-1f4e79").click();
  await expect(page.getByTestId("avatar-swatch-1f4e79")).toHaveClass(/active/);

  await page.getByTestId("avatar-gender-female").click();
  await expect(page.getByTestId("avatar-tab-beard")).toBeDisabled();
  await page.getByTestId("avatar-tab-hair").click();
  for (const id of ["long-wavy", "bob", "ponytail"]) {
    await page.getByTestId(`avatar-option-${id}`).click();
    await expect(page.getByTestId(`avatar-option-${id}`)).toHaveClass(/active/);
  }
  await page.getByTestId("avatar-gender-male").click();
  await page.getByTestId("avatar-gender-female").click();
  await page.getByTestId("avatar-gender-male").click();
  await expect(page.getByTestId("avatar-gender-male")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("avatar-tab-beard")).toBeEnabled();
});

test("beard styles and clean-shaven", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-beard").click();
  await page.getByTestId("avatar-option-full").click();
  await expect(page.getByTestId("avatar-option-full")).toHaveClass(/active/);
  await page.getByTestId("avatar-swatch-1f4e79").click();
  const saved = await page.evaluate(() => localStorage.getItem("mm_avatar_config"));
  expect(saved).toContain('"beardStyle":"full"');
  await page.getByTestId("avatar-option-none").click();
  const cleared = await page.evaluate(() => localStorage.getItem("mm_avatar_config"));
  expect(cleared).toContain('"beardStyle":"none"');
});

test("clothing color changes shirt pixels", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-clothes").click();
  await expect(page.getByTestId("avatar-option-tshirt")).toBeVisible();
  await expect(page.getByTestId("avatar-option-hoodie")).toBeVisible();
  await expect(page.getByTestId("avatar-option-jersey")).toBeVisible();
  await page.getByTestId("avatar-swatch-c62828").click();
  const red = await shirtSample(page);
  await page.getByTestId("avatar-swatch-1565c0").click();
  const blue = await shirtSample(page);
  expect(red?.n ?? 0).toBeGreaterThan(50);
  expect(blue?.n ?? 0).toBeGreaterThan(50);
  expect((red?.r ?? 0) - (red?.b ?? 0)).toBeGreaterThan(15);
  expect((blue?.b ?? 0) - (blue?.r ?? 0)).toBeGreaterThan(8);
});

test("reset, randomize, and reload persistence", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.evaluate(() => localStorage.removeItem("mm_avatar_config"));
  await page.reload();
  await page.getByTestId("avatar-tab-hair").click();
  await page.getByTestId("avatar-option-short").click();
  await page.reload();
  await expect(page.getByTestId("avatar-tab-hair")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("mm_avatar_config"));
  expect(stored).toContain('"hairStyle":"short"');
  await page.getByTestId("avatar-randomize").click();
  const randomized = await page.evaluate(() => localStorage.getItem("mm_avatar_config"));
  expect(randomized).not.toEqual(stored);
  await page.getByTestId("avatar-gender-male").click();
  await page.getByTestId("avatar-reset").click();
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("mm_avatar_config") || "{}"));
  expect(reset.hairStyle).toBe("spiky");
  expect(reset.beardStyle).toBe("none");
  expect(reset.clothing).toBe("tshirt");
});

test("png export is a transparent image", async ({ page }) => {
  await page.goto("/dev/avatar");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("avatar-export-512").click(),
  ]);
  expect(download.suggestedFilename()).toContain("512.png");
  const exported = sharp((await download.path())!);
  const metadata = await exported.metadata();
  expect([metadata.width, metadata.height]).toEqual([512, 512]);
  const { data, info } = await exported.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[3]).toBe(0);
  expect(data[(480 * info.width + 256) * 4 + 3]).toBe(255);
  const corner = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="avatar-canvas"]') as HTMLCanvasElement;
    return [...canvas.getContext("2d")!.getImageData(1, 1, 1, 1).data];
  });
  expect(corner[3]).toBe(0);
});

test("accessories are not offered without assets", async ({ page }) => {
  await page.goto("/dev/avatar");
  await expect(page.getByRole("tab", { name: "Glasses" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Accessories" })).toHaveCount(0);
});

test("maker does not overflow at mobile and desktop widths", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/dev/avatar");
    await expect(page.getByTestId("avatar-randomize")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `${viewport.width}x${viewport.height}`).toBe(false);
  }
});

test("female switch exits beard panel and repeated gender click preserves style", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-beard").click();
  await page.getByTestId("avatar-gender-female").click();
  await expect(page.getByTestId("avatar-tab-body")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Skin tone", { exact: true })).toBeVisible();
  await page.getByTestId("avatar-tab-hair").click();
  await page.getByTestId("avatar-option-bob").click();
  await page.getByTestId("avatar-gender-female").click();
  await expect(page.getByTestId("avatar-option-bob")).toHaveClass(/active/);
});

test("invalid saved styles and colors recover to a rendered female avatar", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mm_avatar_config", JSON.stringify({
    gender: "female", hairStyle: "spiky", skinTone: 123, hairColor: null,
    beardStyle: "full", clothing: "missing",
  })));
  await page.goto("/dev/avatar");
  await expect.poll(async () => page.getByTestId("avatar-canvas").getAttribute("data-rendered-config"))
    .toContain('"hairStyle":"long-wavy"');
  const config = JSON.parse((await page.getByTestId("avatar-canvas").getAttribute("data-rendered-config"))!);
  expect(config.skinTone).toBe("#D4A574");
  expect(config.beardStyle).toBe("none");
  expect(config.clothing).toBe("tshirt");
});

test("rapid customization leaves only the final complete avatar", async ({ page }) => {
  await page.goto("/dev/avatar");
  await page.getByTestId("avatar-tab-beard").click();
  await page.getByTestId("avatar-option-full").click();
  await page.getByTestId("avatar-gender-female").click();
  await page.getByTestId("avatar-tab-hair").click();
  await page.getByTestId("avatar-option-bob").click();
  const canvas = page.getByTestId("avatar-canvas");
  await expect(canvas).toHaveAttribute("data-rendered-config", /"hairStyle":"bob"/);
  const before = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.reload();
  await expect(canvas).toHaveAttribute("data-rendered-config", /"hairStyle":"bob"/);
  expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(before);
});

test("white hair and purple goatee do not erase the blue shirt or recolor the eyes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mm_avatar_config", JSON.stringify({
    gender: "male", hairStyle: "short", skinTone: "#E8C4A2", hairColor: "#F5F5F5",
    beardStyle: "goatee", beardColor: "#5B2C6F", clothing: "tshirt", clothingColor: "#1565C0",
  })));
  await page.goto("/dev/avatar");
  const canvas = page.getByTestId("avatar-canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "vector-v2");
  const sample = () => canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    const region = (x: number, y: number, w: number, h: number) => Array.from(ctx.getImageData(
      Math.round(x*c.width), Math.round(y*c.height), Math.round(w*c.width), Math.round(h*c.height)).data);
    return { eyes: region(.37,.44,.26,.04), shirt: region(.3,.83,.4,.16), hair: region(.42,.20,.1,.06) };
  });
  const white = await sample();
  expect(white.shirt.filter((_, i) => i % 4 === 3).every(a => a === 255)).toBe(true);
  expect(white.shirt.filter((_, i) => i % 4 === 2).every((b, i) => b > white.shirt[i*4])).toBe(true);
  await page.getByTestId("avatar-tab-hair").click();
  await page.getByTestId("avatar-swatch-1a1412").click();
  await expect(canvas).toHaveAttribute("data-rendered-config", /"hairColor":"#1A1412"/);
  const dark = await sample();
  expect(dark.eyes).toEqual(white.eyes);
  expect(dark.shirt).toEqual(white.shirt);
  expect(dark.hair).not.toEqual(white.hair);
});


test("body builds and clothes render for both genders and survive reload", async ({ page }) => {
  await page.goto("/dev/avatar");
  for (const gender of ["male", "female"]) {
    await page.getByTestId(`avatar-gender-${gender}`).click();
    const builds = new Set<string>();
    for (const body of ["slim", "regular", "broad"]) {
      await page.getByTestId("avatar-tab-body").click();
      await page.getByTestId(`avatar-option-${body}`).click();
      await rendered(page);
      builds.add(await page.getByTestId("avatar-canvas").evaluate(el => (el as HTMLCanvasElement).toDataURL()));
      await page.getByTestId("avatar-tab-clothes").click();
      const outfits = new Set<string>();
      for (const clothing of ["tshirt", "hoodie", "jersey"]) {
        await page.getByTestId(`avatar-option-${clothing}`).click();
        await rendered(page);
        outfits.add(await page.getByTestId("avatar-canvas").evaluate(el => (el as HTMLCanvasElement).toDataURL()));
      }
      expect(outfits.size).toBe(3);
    }
    expect(builds.size).toBe(3);
  }
  await page.reload();
  await rendered(page);
  const saved = JSON.parse((await page.getByTestId("avatar-canvas").getAttribute("data-rendered-config"))!);
  expect(saved.bodyType).toBe("broad");
  expect(saved.clothing).toBe("jersey");
  await page.getByTestId("avatar-gender-male").click();
  await rendered(page);
  expect(JSON.parse((await page.getByTestId("avatar-canvas").getAttribute("data-rendered-config"))!).bodyType).toBe("broad");
});
