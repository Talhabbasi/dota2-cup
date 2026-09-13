import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { registeredRoleName } from "./payments-channel-access";

const GOLD = 0xb07d1f;

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

export function dummyAuctionChannelName() {
  return process.env.DUMMY_AUCTION_CHANNEL_NAME?.trim() || "auction-test";
}

export function isDummyAuctionChannel(
  name: string | null | undefined,
): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n === dummyAuctionChannelName().toLowerCase() ||
    n === "auction-test" ||
    n === "dummy-auction"
  );
}

function findTextChannel(guild: Guild, name: string): TextChannel | null {
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

function findRole(guild: Guild, name: string) {
  return (
    guild.roles.cache.find(
      (role) => role.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

async function applyDummyAuctionPermissions(
  channel: TextChannel,
  guild: Guild,
) {
  const adminRole = findRole(guild, adminRoleName());
  const captainRole = findRole(guild, captainRoleName());
  const registeredRole = findRole(guild, registeredRoleName());
  const botMember = guild.members.me;

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
    SendMessages: false,
  });
  if (captainRole) {
    await channel.permissionOverwrites.edit(captainRole, {
      ViewChannel: false,
      SendMessages: false,
    });
  }
  if (registeredRole) {
    await channel.permissionOverwrites.edit(registeredRole, {
      ViewChannel: false,
      SendMessages: false,
    });
  }
  if (adminRole) {
    await channel.permissionOverwrites.edit(adminRole, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      AttachFiles: true,
      ManageMessages: true,
      UseApplicationCommands: true,
    });
  }
  if (botMember) {
    await channel.permissionOverwrites.edit(botMember, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      ManageMessages: true,
      UseApplicationCommands: true,
    });
  }
}

export function dummyAuctionHowToEmbed() {
  const name = dummyAuctionChannelName();
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle("TEST AUCTION — does not affect the live cup")
    .setDescription(
      [
        `This **#${name}** channel is Admin-only practice.`,
        "Fake players and fake teams. **No website, purse, roster, or #auction changes.**",
        "",
        "`/auction start rank:divine` — start a fake rank pool (Liquid / OG / Secret, 20,000 purse each)",
        "Bid with the **+100 / +500** buttons or `/bid amount:500`",
        "Clicking +100 again bids as the **next dummy team**, so one Admin can test a bidding war",
        "Admin: **Confirm** sells to the high bidder. **Skip** passes the player. Clock does not auto-charge.",
        "`/bid amount:600 team:Test OG` — bid as a specific dummy team",
        "`/auction pause` · `/auction skip`",
        "",
        "Live cup auction stays in **#auction**. Do not start a real auction here.",
      ].join("\n"),
    );
}

async function pinHowTo(channel: TextChannel, botUserId?: string) {
  try {
    const { items } = await channel.messages.fetchPins();
    const existing = items.find((pin) => {
      const title = pin.message.embeds[0]?.title ?? "";
      if (!title.startsWith("TEST AUCTION")) return false;
      if (botUserId && pin.message.author.id !== botUserId) return false;
      return true;
    });
    if (existing) {
      await existing.message.edit({ embeds: [dummyAuctionHowToEmbed()] });
      return;
    }
  } catch {
    /* pins optional */
  }
  const sent = await channel.send({ embeds: [dummyAuctionHowToEmbed()] });
  try {
    await sent.pin();
  } catch {
    /* pin optional */
  }
}

export async function ensureDummyAuctionChannel(
  guild: Guild,
  options?: { botUserId?: string },
): Promise<TextChannel> {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const name = dummyAuctionChannelName();
  const existing =
    findTextChannel(guild, name) ??
    findTextChannel(guild, "auction-test") ??
    findTextChannel(guild, "dummy-auction");

  if (existing) {
    try {
      await applyDummyAuctionPermissions(existing, guild);
    } catch (error) {
      console.warn(
        `Could not lock #${existing.name} to Admin only:`,
        error instanceof Error ? error.message : error,
      );
    }
    try {
      await pinHowTo(existing, options?.botUserId);
    } catch (error) {
      console.warn(
        `Could not pin #${existing.name} how-to:`,
        error instanceof Error ? error.message : error,
      );
    }
    return existing;
  }

  const adminRole = findRole(guild, adminRoleName());
  const captainRole = findRole(guild, captainRoleName());
  const registeredRole = findRole(guild, registeredRoleName());
  const botMember = guild.members.me;
  const overwrites: {
    id: string;
    allow?: bigint[];
    deny?: bigint[];
  }[] = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ],
    },
  ];
  if (captainRole) {
    overwrites.push({
      id: captainRole.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ],
    });
  }
  if (registeredRole) {
    overwrites.push({
      id: registeredRole.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ],
    });
  }
  if (adminRole) {
    overwrites.push({
      id: adminRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.UseApplicationCommands,
      ],
    });
  }
  if (botMember) {
    overwrites.push({
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.UseApplicationCommands,
      ],
    });
  }

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic:
      "TEST auction only — fake bids. Does not change live cup data or #auction.",
    permissionOverwrites: overwrites,
    reason: "MM Dota Cup admin-only auction practice channel",
  });
  try {
    await pinHowTo(channel, options?.botUserId);
  } catch {
    /* pin optional */
  }
  return channel;
}
