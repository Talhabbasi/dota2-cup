import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { prisma } from "./prisma";
import { registeredRoleName } from "./payments-channel-access";
import {
  RELEASES,
  type ReleaseNote,
  type UpdateKind,
} from "./releases";
import { CUP_NAME } from "@/lib/brand";

const GOLD = 0xb07d1f;

export function updatesChannelName() {
  return process.env.UPDATES_CHANNEL_NAME?.trim() || "updates";
}

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
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

async function lockUpdatesChannel(channel: TextChannel, guild: Guild) {
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
    });
  }
  if (botMember) {
    await channel.permissionOverwrites.edit(botMember.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      ManageMessages: true,
    });
  }
}

export async function ensureUpdatesChannel(guild: Guild): Promise<TextChannel> {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const name = updatesChannelName();
  const existing = findTextChannel(guild, name);
  if (existing) {
    await lockUpdatesChannel(existing, guild);
    return existing;
  }

  const adminRole = findRole(guild, adminRoleName());
  const botMember = guild.members.me;
  const overwrites: {
    id: string;
    allow?: bigint[];
    deny?: bigint[];
  }[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
  ];
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
      ],
    });
  }

  const created = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic: `${CUP_NAME} — admin-only release notes (Added / Fixed / Removed)`,
    permissionOverwrites: overwrites,
    reason: `${CUP_NAME} admin updates channel`,
  });
  return created;
}

function fieldFrom(label: string, lines: string[]) {
  if (lines.length === 0) return null;
  return {
    name: label,
    value: lines.map((line) => `• ${line}`).join("\n").slice(0, 1024),
  };
}

export function releaseEmbed(note: ReleaseNote) {
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(note.title)
    .setDescription("Admin-only cup changelog.")
    .setTimestamp(new Date());
  const added = fieldFrom("Added", note.added);
  const fixed = fieldFrom("Fixed", note.fixed);
  const removed = fieldFrom("Removed", note.removed);
  const fields = [added, fixed, removed].filter(
    (field): field is NonNullable<typeof field> => Boolean(field),
  );
  if (fields.length > 0) embed.setFields(fields);
  return embed;
}

export function kindEmbed(kind: UpdateKind, text: string, author: string) {
  const title =
    kind === "added" ? "Added" : kind === "fixed" ? "Fixed" : "Removed";
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(title)
    .setDescription(text)
    .setFooter({ text: `Posted by ${author}` })
    .setTimestamp(new Date());
}

export async function postReleaseToGuild(guild: Guild, note: ReleaseNote) {
  const channel = await ensureUpdatesChannel(guild);
  const posted = await prisma.postedRelease.findUnique({
    where: { id: note.id },
  });
  if (posted?.messageId) {
    return { channel, skipped: true as const, messageId: posted.messageId };
  }
  const message = await channel.send({ embeds: [releaseEmbed(note)] });
  await prisma.postedRelease.upsert({
    where: { id: note.id },
    create: {
      id: note.id,
      title: note.title,
      messageId: message.id,
      channelId: channel.id,
    },
    update: {
      title: note.title,
      messageId: message.id,
      channelId: channel.id,
      postedAt: new Date(),
    },
  });
  return { channel, skipped: false as const, messageId: message.id };
}

export async function postPendingReleases(guild: Guild) {
  const results: { id: string; skipped: boolean }[] = [];
  for (const note of RELEASES) {
    const posted = await postReleaseToGuild(guild, note);
    results.push({ id: note.id, skipped: posted.skipped });
  }
  return results;
}

export async function postAdHocUpdate(
  guild: Guild,
  input: { kind: UpdateKind; text: string; author: string },
) {
  const channel = await ensureUpdatesChannel(guild);
  const message = await channel.send({
    embeds: [kindEmbed(input.kind, input.text, input.author)],
  });
  return { channel, messageId: message.id };
}
