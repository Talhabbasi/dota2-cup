import "../bot/load-env";

import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import {
  isCupOrganizer,
  looksLikeScamSpamMessage,
} from "../src/lib/anti-spam-moderation";

/**
 * Delete existing crypto/nitro @everyone scam posts from guild text channels.
 * Does not change AutoMod rules.
 */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("Set DISCORD_TOKEN and DISCORD_GUILD_ID.");
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  let scanned = 0;
  let deleted = 0;
  const perChannel = 200;

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    try {
      let before: string | undefined;
      let fetched = 0;
      while (fetched < perChannel) {
        const batch = await channel.messages.fetch({
          limit: 100,
          ...(before ? { before } : {}),
        });
        if (batch.size === 0) break;
        for (const message of batch.values()) {
          scanned += 1;
          if (message.author.bot) continue;
          const member =
            message.member ??
            (await guild.members.fetch(message.author.id).catch(() => null));
          if (isCupOrganizer(member, message.author.id)) continue;
          if (!looksLikeScamSpamMessage(message)) continue;
          try {
            await message.delete();
            deleted += 1;
            console.log(
              `Deleted in #${channel.name} from ${message.author.tag}: ${
                (message.content || "[image/attachment]").slice(0, 80)
              }`,
            );
          } catch (error) {
            console.warn(
              `Could not delete ${message.id} in #${channel.name}:`,
              error instanceof Error ? error.message : error,
            );
          }
        }
        before = batch.last()?.id;
        fetched += batch.size;
        if (batch.size < 100) break;
      }
    } catch (error) {
      console.warn(
        `Skip #${channel.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`Done. Scanned ${scanned} messages, deleted ${deleted} scam post(s).`);
  await client.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
