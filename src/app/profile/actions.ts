"use server";

import { revalidatePath } from "next/cache";
import { STARTING_ROLES } from "@/lib/constants";
import { currentPlayer } from "@/lib/auth";
import { parseAvatarConfig } from "@/lib/avatar/defaults";
import {
  availableBeardStyles,
  availableClothingStyles,
  availableHairStyles,
} from "@/lib/avatar/manifest";
import {
  BEARD_COLORS,
  CLOTHING_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
} from "@/lib/avatar/colors";
import type { AvatarConfig } from "@/lib/avatar/types";
import { prisma } from "@/lib/prisma";

function inList(options: readonly string[], value: string) {
  return options.includes(value) ? value : "";
}

function sanitizeAvatarConfig(raw: string, useDefault: boolean): string {
  if (useDefault || !raw.trim()) return "";
  const parsed = parseAvatarConfig(raw);
  if (!parsed) return "";
  const hairs = availableHairStyles(parsed.gender);
  const beards = availableBeardStyles();
  const clothes = availableClothingStyles();
  const config: AvatarConfig = {
    gender: parsed.gender,
    bodyType: parsed.bodyType,
    skinTone: inList(SKIN_TONES, parsed.skinTone) || SKIN_TONES[2],
    hairStyle: inList(hairs, parsed.hairStyle) || hairs[0] || "spiky",
    hairColor: inList(HAIR_COLORS, parsed.hairColor) || HAIR_COLORS[0],
    beardStyle:
      parsed.gender === "male"
        ? inList(beards, parsed.beardStyle) || "none"
        : "none",
    beardColor: inList(BEARD_COLORS, parsed.beardColor) || BEARD_COLORS[0],
    clothing: inList(clothes, parsed.clothing) || "tshirt",
    clothingColor: inList(CLOTHING_COLORS, parsed.clothingColor) || CLOTHING_COLORS[0],
    eyeColor: inList(EYE_COLORS, parsed.eyeColor) || EYE_COLORS[0],
    accessories: [],
  };
  return JSON.stringify(config);
}

export async function saveProfile(formData: FormData) {
  const { session, player } = await currentPlayer();
  const discordId = session?.user?.discordId;
  if (!discordId) return { error: "Sign in with Discord first." };

  const profileName = String(formData.get("profileName") ?? "").trim().slice(0, 40);
  const about = String(formData.get("about") ?? "").trim().slice(0, 400);
  const roles = formData
    .getAll("roles")
    .map(String)
    .filter((role) => (STARTING_ROLES as readonly string[]).includes(role));
  const useDefault = formData.get("useDefault") === "1";
  const avatarConfig = sanitizeAvatarConfig(
    String(formData.get("avatarConfig") ?? ""),
    useDefault,
  );

  const data = {
    profileName,
    about,
    avatarConfig,
    // Clear legacy flat-character fields when the layered config is the source of truth.
    gender: "",
    age: "",
    tone: "",
    hairColor: "",
    hairStyle: "",
    faceType: "",
    beard: "",
  };

  if (player) {
    await prisma.player.update({
      where: { id: player.id },
      data: {
        ...data,
        rolesJson: roles.length ? JSON.stringify(roles) : player.rolesJson,
      },
    });
  } else {
    const discordName = session?.user?.name?.trim().slice(0, 80) || "Player";
    await prisma.player.create({
      data: {
        discordId,
        discordName,
        steamName: profileName || discordName,
        medal: "",
        rolesJson: JSON.stringify(roles),
        ...data,
      },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/teams");
  revalidatePath("/teams/[id]", "page");
  revalidatePath("/dota/teams");
  revalidatePath("/pubg/teams");
  return { ok: true as const };
}
