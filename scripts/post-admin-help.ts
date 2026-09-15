import "../bot/load-env";

import { Client, GatewayIntentBits } from "discord.js";
import {
  ensureAdminChannel,
  postAdminCommandHelp,
} from "../src/lib/cup-announcements";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("Set DISCORD_TOKEN and DISCORD_GUILD_ID.");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  const admin = await ensureAdminChannel(guild);
  const help = await postAdminCommandHelp(admin, {
    force: true,
    botUserId: client.user?.id,
  });
  console.log(
    help.skipped
      ? `Help already pinned in #${admin.name}`
      : `Posted and pinned ${help.posted} message(s) in #${admin.name}`,
  );
  await client.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
