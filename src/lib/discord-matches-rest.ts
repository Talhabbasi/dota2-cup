/**
 * Post / update #matches embeds from the Next.js admin panel via Discord REST
 * (no gateway login — avoids kicking the running bot).
 */

import type { APIEmbed } from "discord.js";
import {
  GROUP_STAGE_POST_TITLE,
  groupStageScheduleEmbeds,
} from "./group-stage-discord";
import type { BookedGroupMatch } from "./group-stage-schedule";
import {
  PLAYOFF_POST_TITLE,
  playoffEmbeds,
} from "./playoff-discord";
import { getPlayoffViewFresh } from "./playoff";
import { matchesChannelName } from "./registration-status";

const DISCORD_API = "https://discord.com/api/v10";

async function discordBotFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  return fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

function embedsToJson(embeds: { toJSON: () => APIEmbed }[]): APIEmbed[] {
  return embeds.map((e) => e.toJSON());
}

async function matchesChannelId(): Promise<
  { ok: true; channelId: string; name: string } | { ok: false; reason: string }
> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) return { ok: false, reason: "DISCORD_GUILD_ID not set" };
  if (!process.env.DISCORD_TOKEN?.trim()) {
    return { ok: false, reason: "DISCORD_TOKEN not set" };
  }

  const res = await discordBotFetch("GET", `/guilds/${guildId}/channels`);
  if (!res?.ok) {
    return { ok: false, reason: "Could not list Discord channels" };
  }
  const channels = (await res.json()) as {
    id: string;
    name: string;
    type: number;
  }[];
  const want = matchesChannelName().toLowerCase();
  const hit = channels.find(
    (ch) => ch.type === 0 && ch.name.toLowerCase() === want,
  );
  if (!hit) {
    return {
      ok: false,
      reason: `#${matchesChannelName()} missing — run /admin setup in Discord first`,
    };
  }
  return { ok: true, channelId: hit.id, name: hit.name };
}

async function pinMessage(channelId: string, messageId: string) {
  await discordBotFetch("PUT", `/channels/${channelId}/pins/${messageId}`);
}

async function findPinnedByTitle(
  channelId: string,
  title: string,
): Promise<string | null> {
  const res = await discordBotFetch("GET", `/channels/${channelId}/pins`);
  if (!res?.ok) return null;
  const raw = await res.json();
  // Classic pins: Message[]. Pin overhaul: { items: [{ message }] }.
  const messages: { id: string; embeds?: { title?: string }[] }[] = Array.isArray(
    raw,
  )
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items.map(
          (row: { message?: { id: string; embeds?: { title?: string }[] }; id?: string; embeds?: { title?: string }[] }) =>
            row.message ?? row,
        )
      : [];
  const hit = messages.find((msg) => msg.embeds?.[0]?.title === title);
  return hit?.id ?? null;
}

export async function postGroupStageToMatchesRest(result: {
  saturday: string;
  sunday: string;
  fixtures: BookedGroupMatch[];
}): Promise<{ ok: true; detail: string } | { ok: false; reason: string }> {
  const channel = await matchesChannelId();
  if (!channel.ok) return channel;

  const embeds = embedsToJson(groupStageScheduleEmbeds(result));
  const existing = await findPinnedByTitle(
    channel.channelId,
    GROUP_STAGE_POST_TITLE,
  );

  if (existing) {
    const edit = await discordBotFetch(
      "PATCH",
      `/channels/${channel.channelId}/messages/${existing}`,
      { embeds },
    );
    if (!edit?.ok) {
      return { ok: false, reason: "Could not update pinned group schedule in Discord" };
    }
    return {
      ok: true,
      detail: `Updated group schedule in #${channel.name}`,
    };
  }

  const sent = await discordBotFetch(
    "POST",
    `/channels/${channel.channelId}/messages`,
    { embeds },
  );
  if (!sent?.ok) {
    return { ok: false, reason: "Could not post group schedule to Discord" };
  }
  const msg = (await sent.json()) as { id: string };
  await pinMessage(channel.channelId, msg.id).catch(() => {});
  return { ok: true, detail: `Posted group schedule in #${channel.name}` };
}

export async function postPlayoffToMatchesRest(): Promise<
  { ok: true; detail: string } | { ok: false; reason: string }
> {
  const view = await getPlayoffViewFresh();
  if (
    !view.groupStageComplete &&
    view.matches.every((match) => match.status === "empty")
  ) {
    return {
      ok: false,
      reason: "Nothing to post yet — finish the group stage first",
    };
  }

  const channel = await matchesChannelId();
  if (!channel.ok) return channel;

  const embeds = embedsToJson(playoffEmbeds(view));
  const existing = await findPinnedByTitle(
    channel.channelId,
    PLAYOFF_POST_TITLE,
  );

  if (existing) {
    const edit = await discordBotFetch(
      "PATCH",
      `/channels/${channel.channelId}/messages/${existing}`,
      { embeds },
    );
    if (!edit?.ok) {
      return { ok: false, reason: "Could not update pinned playoff bracket in Discord" };
    }
    return {
      ok: true,
      detail: `Updated playoff bracket in #${channel.name}`,
    };
  }

  const sent = await discordBotFetch(
    "POST",
    `/channels/${channel.channelId}/messages`,
    { embeds },
  );
  if (!sent?.ok) {
    return { ok: false, reason: "Could not post playoff bracket to Discord" };
  }
  const msg = (await sent.json()) as { id: string };
  await pinMessage(channel.channelId, msg.id).catch(() => {});
  return { ok: true, detail: `Posted playoff bracket in #${channel.name}` };
}
