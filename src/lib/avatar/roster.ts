import { defaultAvatarConfig, parseAvatarConfig } from "./defaults";
import { HAIR_COLORS, SKIN_TONES, EYE_COLORS, CLOTHING_COLORS } from "./colors";
import { availableHairStyles } from "./manifest";
import type { AvatarConfig } from "./types";

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

/** Fictional defaults are stable per player, independent of roster ordering. */
export function generatedAvatar(playerId: string): AvatarConfig {
  const pick = <T,>(key: string, values: readonly T[]): T => values[hash(`${playerId}:${key}`) % values.length]!;
  const gender = pick("gender", ["male", "female"] as const);
  const hairColor = pick("hair-color", HAIR_COLORS.slice(0, 7));
  return {
    ...defaultAvatarConfig(gender),
    bodyType: pick("build", ["slim", "regular", "broad"] as const),
    skinTone: pick("skin", SKIN_TONES),
    hairStyle: pick("hair", availableHairStyles(gender)),
    hairColor,
    beardStyle: gender === "male" ? pick("beard", ["none", "none", "stubble", "full", "goatee"]) : "none",
    beardColor: hairColor,
    eyeColor: pick("eyes", EYE_COLORS),
    clothing: "jersey",
    clothingColor: pick("clothes", CLOTHING_COLORS),
  };
}

/** One hue per franchise. Spaced so two teams never land on the same red. */
export const TEAM_KIT_COLORS = [
  "#1565C0",
  "#C62828",
  "#2E7D32",
  "#6A1B9A",
  "#EF6C00",
  "#00838F",
  "#F9A825",
  "#283593",
  "#6D4C41",
  "#00897B",
  "#AD1457",
  "#546E7A",
  "#7CB342",
  "#5E35B1",
  "#0277BD",
  "#F5F5F5",
] as const;

export type TeamKit = {
  color: string;
  clothing: "jersey";
};

/**
 * Every team in the list gets a different shirt.
 * Order of `teamIds` does not matter. The same set always maps the same way,
 * so the teams page and a franchise page stay in sync.
 */
export function teamKitsFor(teamIds: string[]): Map<string, TeamKit> {
  const used = new Set<number>();
  const assigned = new Map<string, TeamKit>();
  const palette = TEAM_KIT_COLORS.length;

  for (const id of [...new Set(teamIds)].sort((a, b) => a.localeCompare(b))) {
    let slot = hash(`team-kit:${id}`) % palette;
    let guard = 0;
    while (used.has(slot) && guard < palette) {
      slot = (slot + 1) % palette;
      guard += 1;
    }
    used.add(slot);
    assigned.set(id, { color: TEAM_KIT_COLORS[slot] ?? TEAM_KIT_COLORS[0], clothing: "jersey" });
  }

  return assigned;
}

export function rosterAvatar(playerId: string, saved?: string | null, kit?: TeamKit | null): AvatarConfig {
  const personal = parseAvatarConfig(saved) ?? generatedAvatar(playerId);
  if (!kit) return personal;
  return { ...personal, clothing: kit.clothing, clothingColor: kit.color };
}
