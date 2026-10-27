/**
 * Post payment confirmations in #payments from the website admin panel.
 * Uses the bot token over REST, so the local gateway bot does not need to be running.
 */

import { noteFailedResponse } from "./public-error";
import {
  formatEntryFee,
  isPaymentsChannelName,
  paymentsChannelName,
} from "./registration-status";
import {
  formatTeamPaymentLine,
  getPaymentCollection,
  listTeamPayments,
} from "./payments";

const API = "https://discord.com/api/v10";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discord(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const headers: Record<string, string> = { Authorization: `Bot ${token}` };
    const init: RequestInit = { method, headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}${path}`, init);
    if (res.status !== 429) {
      if (!res.ok) void noteFailedResponse(`Discord ${method} ${path}`, res);
      return res;
    }
    const data = (await res.json().catch(() => null)) as {
      retry_after?: number;
    } | null;
    await sleep(Math.ceil((data?.retry_after ?? 1) * 1000));
  }
  return null;
}

function mention(discordId: string) {
  const id = discordId.split(":")[0]?.trim() ?? "";
  return /^\d{17,20}$/.test(id) ? `<@${id}>` : null;
}

async function paymentsChannel(): Promise<
  { ok: true; channelId: string; name: string } | { ok: false; reason: string }
> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const name = paymentsChannelName();
  if (!guildId) return { ok: false, reason: "DISCORD_GUILD_ID not set" };
  if (!process.env.DISCORD_TOKEN?.trim()) {
    return { ok: false, reason: "DISCORD_TOKEN not set" };
  }

  const res = await discord("GET", `/guilds/${guildId}/channels`);
  if (!res?.ok) return { ok: false, reason: "Could not list Discord channels" };
  const channels = (await res.json()) as {
    id: string;
    name: string;
    type: number;
  }[];
  const hit = channels.find(
    (channel) => channel.type === 0 && isPaymentsChannelName(channel.name),
  );
  if (!hit) {
    return {
      ok: false,
      reason: `#${name} missing — run /admin setup in Discord first`,
    };
  }
  return { ok: true, channelId: hit.id, name: hit.name };
}

async function collectionLine() {
  const collection = await getPaymentCollection();
  return `**Collected: ${collection.collected.toLocaleString("en-PK")} PKR** (${collection.paidCount} paid · ${collection.unpaidCount} still owe).`;
}

async function teamLine(teamId: string | null) {
  if (!teamId) return "";
  const teams = await listTeamPayments();
  const row = teams.find((team) => team.id === teamId);
  return row ? `\n${formatTeamPaymentLine(row)}` : "";
}

async function post(content: string) {
  const channel = await paymentsChannel();
  if (!channel.ok) return channel;
  const sent = await discord("POST", `/channels/${channel.channelId}/messages`, {
    content,
    allowed_mentions: { parse: ["users"] },
  });
  if (!sent?.ok) {
    return {
      ok: false as const,
      reason: `Could not post in #${channel.name}`,
    };
  }
  return { ok: true as const };
}

export async function announceMarkedPaidInDiscord(input: {
  discordId: string;
  steamName: string;
  teamId: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const who = mention(input.discordId);
  if (!who) {
    return { ok: false, reason: "Player has no Discord account to mention" };
  }
  const content = `✅ Admin confirmed **${formatEntryFee()}** for ${who} (**${input.steamName}**).${await teamLine(input.teamId)}\n${await collectionLine()}`;
  return post(content);
}

export async function announceClearedPaidInDiscord(input: {
  discordId: string;
  steamName: string;
  teamId: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const who = mention(input.discordId);
  if (!who) {
    return { ok: false, reason: "Player has no Discord account to mention" };
  }
  const content = `Payment cleared for ${who} (**${input.steamName}**). They owe **${formatEntryFee()}** again.${await teamLine(input.teamId)}\n${await collectionLine()}`;
  return post(content);
}
