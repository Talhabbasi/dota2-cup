import {
  BASE_CLOTHING_HEX,
  BASE_HAIR_HEX,
  BASE_SKIN_HEX,
} from "./colors";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

const BASE_SKIN = hexToRgb(BASE_SKIN_HEX);
const BASE_HAIR = hexToRgb(BASE_HAIR_HEX);
const BASE_CLOTH = hexToRgb(BASE_CLOTHING_HEX);

function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h, s, l };
}

function hue2rgb(p: number, q: number, t: number) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const v = clamp(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clamp(hue2rgb(p, q, h + 1 / 3) * 255),
    g: clamp(hue2rgb(p, q, h) * 255),
    b: clamp(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Skin tone: keep painted lighting (source lightness), shift hue/sat toward swatch.
 * Soft-blend lightness so dark swatches deepen undertone without blacking out the body.
 */
function shiftSkinTone(
  r: number,
  g: number,
  b: number,
  target: { r: number; g: number; b: number },
) {
  const src = rgbToHsl(r, g, b);
  const tgt = rgbToHsl(target.r, target.g, target.b);
  const base = rgbToHsl(BASE_SKIN.r, BASE_SKIN.g, BASE_SKIN.b);
  // Remap around the painted midtone, keeping the full highlight range.
  // At the default swatch this is an identity transform, including hue/saturation.
  const mid = Math.max(0.2, Math.min(0.85, base.l + (tgt.l - base.l) * 0.45));
  const l = src.l <= base.l
    ? src.l * mid / base.l
    : mid + (src.l - base.l) * (1 - mid) / (1 - base.l);
  const h = (src.h + (tgt.h - base.h) * 0.15 + 1) % 1;
  const shadowSaturation = 1 - Math.max(0, base.l - tgt.l) * 0.65;
  const s = Math.max(0, Math.min(0.9, (src.s + (tgt.s - base.s) * 0.2) * shadowSaturation));
  return hslToRgb(h, s, l);
}

function remapPalette(
  r: number,
  g: number,
  b: number,
  base: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
) {
  return {
    r: clamp((r * target.r) / Math.max(1, base.r)),
    g: clamp((g * target.g) / Math.max(1, base.g)),
    b: clamp((b * target.b) / Math.max(1, base.b)),
  };
}

function tintDarkLayer(
  r: number,
  g: number,
  b: number,
  target: { r: number; g: number; b: number },
  midLum: number,
  floor = 0.32,
) {
  const srcY = Math.max(1, lum(r, g, b));
  const norm = srcY / midLum;
  const scale = floor + Math.min(1.45, norm) * (1 - floor);
  return {
    r: clamp(target.r * scale),
    g: clamp(target.g * scale),
    b: clamp(target.b * scale),
  };
}

function isSkinPixel(r: number, g: number, b: number, row: number, height: number) {
  const y = lum(r, g, b);
  if (y < 55 || y > 235) return false;
  if (r < 80 && g < 60 && b < 55) return false;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (chroma < 16) return false;
  // Warm skin only
  if (!(r >= g - 4 && g >= b - 8 && r - b >= 20)) return false;
  // In hair band, require stronger skin signal so bangs/fringe stay hair.
  if (row < height * 0.28 && (y < 90 || r - b < 28)) return false;
  return true;
}

function isHairPixel(r: number, g: number, b: number, row: number, height: number) {
  if (row > height * 0.52) return false;
  if (isSkinPixel(r, g, b, row, height)) return false;
  const y = lum(r, g, b);
  if (y > 160 || y < 4) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (y > 125 && max - min < 28) return false;
  if (r > 150 && r - b > 55 && r - g > 25 && y > 90) return false;
  return y < 150;
}

function isClothingPixel(r: number, g: number, b: number, row: number, height: number) {
  if (row < height * 0.48) return false;
  if (isSkinPixel(r, g, b, row, height)) return false;
  const y = lum(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (y > 120) return false;
  return y < 90 || max - min < 40;
}

export type RecolorPass = {
  skinTone?: string;
  hairColor?: string;
  clothingColor?: string;
  beardColor?: string;
  mode: "base" | "beard" | "clothing" | "hair";
};

/**
 * Background removal punched out the black tee, leaving a transparent hole
 * between the arms. Paint that interior gap with the clothing color so the
 * shirt is real pixels, not the page background showing through.
 */
function paintClothPixel(
  data: Uint8ClampedArray,
  i: number,
  cloth: { r: number; g: number; b: number },
  scale: number,
) {
  data[i] = clamp(cloth.r * scale);
  data[i + 1] = clamp(cloth.g * scale);
  data[i + 2] = clamp(cloth.b * scale);
  data[i + 3] = 255;
}

export function fillInteriorShirt(
  imageData: ImageData,
  clothingColor: string,
) {
  const { data, width, height } = imageData;
  const cloth = hexToRgb(clothingColor);
  const start = Math.floor(height * 0.56);

  const scaleAt = (y: number) => 0.58 + 0.18 * ((y - start) / Math.max(1, height - start));

  for (let y = start; y < height; y++) {
    const scale = scaleAt(y);
    let x = 0;
    while (x < width) {
      while (x < width && data[(y * width + x) * 4 + 3]! <= 24) x++;
      const left = x - 1;
      while (x < width && data[(y * width + x) * 4 + 3]! > 24) x++;
      const gapStart = x;
      while (x < width && data[(y * width + x) * 4 + 3]! <= 24) x++;
      const gapEnd = x - 1;
      const right = x;
      if (left < 1 || right >= width) continue;
      if (gapEnd - gapStart < 36) continue;
      for (let gx = gapStart; gx <= gapEnd; gx++) {
        paintClothPixel(data, (y * width + gx) * 4, cloth, scale);
      }
    }


  }

  return imageData;
}

/** Recolor only the matching region of one layer. Preserves alpha and painted lighting. */
export function recolorImageData(
  imageData: ImageData,
  pass: RecolorPass,
): ImageData {
  const { data, width, height } = imageData;
  const skin = pass.skinTone ? hexToRgb(pass.skinTone) : null;
  const hair = pass.hairColor ? hexToRgb(pass.hairColor) : null;
  const cloth = pass.clothingColor ? hexToRgb(pass.clothingColor) : null;
  const beard = pass.beardColor ? hexToRgb(pass.beardColor) : null;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 8) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const row = Math.floor(i / 4 / width);

    if ((pass.mode === "beard" || pass.mode === "hair") && (beard || hair)) {
      const target = pass.mode === "beard" ? beard! : hair!;
      if (a < 24) continue;
      const next = tintDarkLayer(r, g, b, target, 55, 0.36);
      data[i] = next.r;
      data[i + 1] = next.g;
      data[i + 2] = next.b;
      continue;
    }

    if (pass.mode === "clothing" && cloth) {
      if (lum(r, g, b) < 120 && Math.max(r, g, b) - Math.min(r, g, b) < 55) {
        const next =
          lum(cloth.r, cloth.g, cloth.b) < 40
            ? remapPalette(r, g, b, BASE_CLOTH, cloth)
            : tintDarkLayer(r, g, b, cloth, 45, 0.5);
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
      }
      continue;
    }

    if (pass.mode === "base") {
      if (skin && isSkinPixel(r, g, b, row, height)) {
        const next = shiftSkinTone(r, g, b, skin);
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
        continue;
      }
      if (hair && isHairPixel(r, g, b, row, height)) {
        const next =
          lum(hair.r, hair.g, hair.b) < 45
            ? remapPalette(r, g, b, BASE_HAIR, hair)
            : tintDarkLayer(r, g, b, hair, 70, 0.34);
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
        continue;
      }
      if (cloth && isClothingPixel(r, g, b, row, height)) {
        const next =
          lum(cloth.r, cloth.g, cloth.b) < 40
            ? remapPalette(r, g, b, BASE_CLOTH, cloth)
            : tintDarkLayer(r, g, b, cloth, 45, 0.5);
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
      }
    }
  }

  return imageData;
}
