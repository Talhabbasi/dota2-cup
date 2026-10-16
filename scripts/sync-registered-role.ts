import "../bot/load-env";

import { Client, GatewayIntentBits } from "discord.js";
import { syncLiveSeasonDiscordRoles } from "../src/lib/discord-access";
import { prisma } from "../src/lib/prisma";
import { getLiveSeason } from "../src/lib/seasons";

/** Align Discord Registered / weekend / team / Captain tags to the live season only. */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) throw new Error("Missing Discord env");

  const live = await getLiveSeason();
  if (!live) throw new Error("No live season");

  const members = await prisma.seasonPlayer.findMany({
    where: { seasonId: live.id },
    include: { player: { select: { steamName: true, discordName: true } } },
    orderBy: { player: { steamName: "asc" } },
  });
  console.log(`Live Season ${live.number} members (${members.length}):`);
  for (const m of members) {
    console.log(`  - ${m.player.steamName} (${m.player.discordName})`);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  await syncLiveSeasonDiscordRoles(guild);
  await client.destroy();
  console.log("Done — only live-season players keep Registered / cup tags.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
