import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Guild } from "discord.js";

const ICON_FILE = "mm-dota-cup-icon.png";

function guildIconPath() {
  return path.join(process.cwd(), "public", ICON_FILE);
}

/** Discord channels cannot have photos. This sets the server (guild) icon instead. */
export async function syncGuildIcon(guild: Guild) {
  const icon = await readFile(guildIconPath());
  await guild.setIcon(icon, "MM Dota Cup server icon");
}
