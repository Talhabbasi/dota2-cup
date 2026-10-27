import "../bot/load-env";

import { ChannelType, Client, GatewayIntentBits, type TextChannel } from "discord.js";
import {
  paymentsAnnouncementContent,
  paymentsChannelEmbed,
  refreshPinnedPaymentAnnouncement,
} from "../src/lib/cup-announcements";
import { paymentsChannelName } from "../src/lib/registration-status";

/** Update the pinned #payments post and ping @everyone with account details. */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("Set DISCORD_TOKEN and DISCORD_GUILD_ID.");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  await refreshPinnedPaymentAnnouncement(guild, client.user?.id);

  const name = paymentsChannelName();
  const payments = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  ) as TextChannel | undefined;

  if (!payments) {
    throw new Error(`#${name} not found — run /admin setup first.`);
  }

  // Always send a visible @everyone notice so players see account details now.
  const sent = await payments.send({
    content: paymentsAnnouncementContent({ mentionEveryone: true }),
    embeds: [paymentsChannelEmbed()],
    allowedMentions: { parse: ["everyone"] },
  });
  await sent.pin().catch(() => undefined);

  console.log(`Posted payment details + @everyone in #${payments.name}`);
  await client.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
