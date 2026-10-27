import "../bot/load-env";

import { Client, GatewayIntentBits } from "discord.js";
import { setupCupDiscord } from "../src/lib/cup-announcements";

/** Same as Discord `/admin setup` — DB is source of truth for rooms/locks. */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("Set DISCORD_TOKEN and DISCORD_GUILD_ID.");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  console.log(`Running /admin setup for ${guild.name}…`);
  const results = await setupCupDiscord(guild, {
    botUserId: client.user?.id,
    announce: false,
    forceHelp: true,
  });
  for (const row of results) {
    console.log(`${row.ok ? "✅" : "❌"} ${row.channel} — ${row.detail}`);
  }
  await client.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
