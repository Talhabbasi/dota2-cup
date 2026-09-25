import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Guild } from "discord.js";
import { CUP_ICON_FILE, CUP_NAME } from "@/lib/brand";

const ICON_FILE = CUP_ICON_FILE;

function guildIconPath() {
  return path.join(process.cwd(), "public", ICON_FILE);
}

/** Discord channels cannot have photos. This sets the server (guild) icon instead. */
export async function syncGuildIcon(guild: Guild) {
  const icon = await readFile(guildIconPath());
  await guild.setIcon(icon, `${CUP_NAME} server icon`);
}
