import "../bot/load-env";

import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type TextChannel,
} from "discord.js";
import { CHANNEL_GUIDE_NAMES } from "../src/lib/rules";
import { postChannelGuides } from "../src/lib/post-channel-guides";

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function purgeChannel(channel: TextChannel) {
  let deleted = 0;
  for (let i = 0; i < 40; i++) {
    const batch = await channel.messages.fetch({ limit: 100 });
    if (batch.size === 0) break;

    const young = batch.filter((m) => Date.now() - m.createdTimestamp < TWO_WEEKS);
    if (young.size > 1) {
      const result = await channel.bulkDelete(young, true);
      deleted += result.size;
    } else if (young.size === 1) {
      await young.first()?.delete();
      deleted += 1;
    }

    const old = batch.filter((m) => Date.now() - m.createdTimestamp >= TWO_WEEKS);
    for (const message of old.values()) {
      await message.delete().catch(() => undefined);
      deleted += 1;
    }

    if (batch.size < 100) break;
  }
  return deleted;
}

async function main() {
  if (!hasFlag("--yes")) {
    console.log("Clears cup Discord channels (register, general, captains, auction, results, schedule).");
    console.log("Re-run with --yes to confirm.");
    return;
  }

  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("Set DISCORD_TOKEN and DISCORD_GUILD_ID.");
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  for (const name of CHANNEL_GUIDE_NAMES) {
    const exists = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText && ch.name.toLowerCase() === name,
    );
    if (!exists) {
      try {
        await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          reason: "MM Dota Cup channel",
        });
        console.log(`created #${name}`);
      } catch (error) {
        console.warn(`could not create #${name}:`, error);
      }
    }
  }
  await guild.channels.fetch();

  const names = new Set(CHANNEL_GUIDE_NAMES.map((n) => n.toLowerCase()));
  const channels = [...guild.channels.cache.values()].filter(
    (ch): ch is TextChannel =>
      ch.type === ChannelType.GuildText && names.has(ch.name.toLowerCase()),
  );

  if (channels.length === 0) {
    console.log("No cup text channels found.");
    await client.destroy();
    return;
  }

  for (const channel of channels) {
    const n = await purgeChannel(channel);
    console.log(`#${channel.name}: deleted ${n} messages`);
  }

  if (client.user) {
    const posted = await postChannelGuides(guild, client.user.id, { force: true });
    for (const row of posted) {
      console.log(`guide #${row.channelName}: ${row.status}`);
    }
  }

  await client.destroy();
  console.log("Discord cup channels cleared and guides re-posted.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
