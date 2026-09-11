import { ChannelType, type GuildMember, type Message } from "discord.js";
import { adminRoleName, isAdminDiscordId } from "./constants";
import {
  formatEntryFee,
  isRegistrationOpen,
  isPaymentsChannelName,
  paymentsChannelName,
} from "./registration-status";

export const COMMAND_ONLY_CHANNEL_NAMES = [
  "register",
  "captains",
  "auction",
] as const;

export type CommandOnlyChannelName = (typeof COMMAND_ONLY_CHANNEL_NAMES)[number];

function registerChannelName() {
  return process.env.REGISTER_CHANNEL_NAME?.trim() || "register";
}

export function cupSiteUrl(): string {
  return (process.env.NEXTAUTH_URL || "https://dota2-cup.vercel.app").replace(
    /\/+$/,
    "",
  );
}

export function isCommandOnlyChannel(
  channelName: string | null | undefined,
): boolean {
  if (!channelName) return false;
  const name = channelName.toLowerCase();
  const register = registerChannelName().toLowerCase();
  return (
    name === register || name === "captains" || name === "auction"
  );
}

export function commandOnlyHint(
  channelName: string,
  registrationOpen = false,
): string {
  const site = cupSiteUrl();
  const register = registerChannelName();
  const name = channelName.toLowerCase();

  if (name === register.toLowerCase()) {
    if (!registrationOpen) {
      return (
        `**#${register}** — public registration is **closed**. ` +
        `Admins can still add someone with \`/player register\`. Chat in **#general**.`
      );
    }
    return (
      `**#${register}** is for slash commands only: \`/register\`, \`/when\`, \`/me\`. ` +
      `If the bot is offline, register at **${site}/register** (sign in with Discord). ` +
      `Say hello and chat in **#general**.`
    );
  }
  if (name === "captains") {
    return (
      "**#captains** is for captain slash commands only (`/roster`, `/purse`, `/schedule`, `/bid`, etc.). " +
      "Chat in **#general**."
    );
  }
  if (name === "auction") {
    return (
      "**#auction** is for auction commands and bids only (`/bid` or the buttons). " +
      "Watch here, chat in **#general**."
    );
  }
  return "This channel is for slash commands only. Chat in **#general**.";
}

export function canBypassCommandOnlyModeration(
  member: GuildMember | null,
  discordId: string,
): boolean {
  if (isAdminDiscordId(discordId)) return true;
  if (!member) return false;
  const admin = adminRoleName();
  return member.roles.cache.some((role) => role.name === admin);
}

/** Delete casual chat in command-only channels. Returns true if the message was removed. */
export async function moderateCommandOnlyChannel(
  message: Message,
): Promise<boolean> {
  if (message.author.bot) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (!isCommandOnlyChannel(message.channel.name)) return false;
  if (
    canBypassCommandOnlyModeration(message.member, message.author.id)
  ) {
    return false;
  }

  try {
    await message.delete();
  } catch (error) {
    console.warn(
      "Could not delete off-topic message (bot needs Manage Messages):",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  try {
    const notice = await message.channel.send({
      content: `<@${message.author.id}> ${commandOnlyHint(
        message.channel.name,
        await isRegistrationOpen(),
      )}`,
    });
    setTimeout(() => notice.delete().catch(() => {}), 12_000);
  } catch {
    /* channel may be locked */
  }

  return true;
}

export function messageHasImage(message: Message) {
  return message.attachments.some((file) => {
    const type = file.contentType ?? "";
    if (type.startsWith("image/")) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(file.name ?? "");
  });
}

/** Delete chat in #payments unless it includes a screenshot (staff can talk). */
export async function moderatePaymentsChannel(
  message: Message,
): Promise<boolean> {
  if (message.author.bot) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (!isPaymentsChannelName(message.channel.name)) {
    return false;
  }
  if (canBypassCommandOnlyModeration(message.member, message.author.id)) {
    return false;
  }
  if (messageHasImage(message)) return false;

  try {
    await message.delete();
  } catch (error) {
    console.warn(
      "Could not delete non-screenshot in payments:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  try {
    const notice = await message.channel.send({
      content:
        `<@${message.author.id}> **#${paymentsChannelName()}** is for **payment screenshots only**. ` +
        `Upload the **${formatEntryFee()}** transfer picture. An Admin clicks ✅ to confirm. Questions go in **#general**.`,
    });
    setTimeout(() => notice.delete().catch(() => {}), 12_000);
  } catch {
    /* ignore */
  }

  return true;
}
