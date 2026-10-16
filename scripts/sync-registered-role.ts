import "../bot/load-env";

import { Client, GatewayIntentBits } from "discord.js";
import { syncLiveSeasonDiscordRoles } from "../src/lib/discord-access";
import { prisma } from "../src/lib/prisma";
import { getLiveSeason } from "../src/lib/seasons";

/** Fast: align Discord cup tags to the live season only. */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) throw new Error("Missing Discord env");

  const live = await getLiveSeason();
  if (!live) throw new Error("No live season");

  const count = await prisma.seasonPlayer.count({
    where: { seasonId: live.id },
  });
  console.log(`Live Season ${live.number}: ${count} registered player(s)`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  const started = Date.now();
  await syncLiveSeasonDiscordRoles(guild);
  console.log(`Done in ${Date.now() - started}ms`);
  await client.destroy();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
