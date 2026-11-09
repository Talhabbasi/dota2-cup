import {
  BEARD_COLORS,
  CLOTHING_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
} from "./colors";
import type { AvatarConfig, AvatarGender } from "./types";

import { availableHairStyles, availableBeardStyles } from "./manifest";

const LIVE_CLOTHING = new Set(["tshirt", "hoodie", "jersey"]);

export function defaultAvatarConfig(gender: AvatarGender = "male"): AvatarConfig {
  return {
    gender,
    bodyType: "regular",
    skinTone: SKIN_TONES[2],
    hairStyle: gender === "male" ? "spiky" : "long-wavy",
    hairColor: HAIR_COLORS[0],
    beardStyle: "none",
    beardColor: BEARD_COLORS[0],
    clothing: "tshirt",
    clothingColor: CLOTHING_COLORS[0],
    eyeColor: EYE_COLORS[0],
    accessories: [],
  };
}

export function parseAvatarConfig(raw: string | null | undefined): AvatarConfig | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<AvatarConfig>;
    if (data.gender !== "male" && data.gender !== "female") return null;
    const base = defaultAvatarConfig(data.gender);
    const clothing =
      typeof data.clothing === "string" && LIVE_CLOTHING.has(data.clothing)
        ? data.clothing
        : base.clothing;
    return {
      ...base,
      ...Object.fromEntries(
        (["skinTone", "hairColor", "beardColor", "clothingColor", "eyeColor"] as const)
          .filter((key) => typeof data[key] === "string" && /^#[0-9a-f]{6}$/i.test(data[key]!))
          .map((key) => [key, data[key]]),
      ),
      hairStyle: availableHairStyles(data.gender).includes(data.hairStyle ?? "")
        ? data.hairStyle! : base.hairStyle,
      beardStyle: data.gender === "male" && availableBeardStyles().includes(data.beardStyle ?? "")
        ? data.beardStyle! : "none",
      gender: data.gender,
      bodyType: data.bodyType === "slim" || data.bodyType === "broad" ? data.bodyType : "regular",
      clothing,
      accessories: Array.isArray(data.accessories) ? data.accessories.map(String) : [],
    };
  } catch {
    return null;
  }
}
