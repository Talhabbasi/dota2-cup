import { ChannelType, type Guild, type TextChannel } from "discord.js";
import {
  buildRulesEmbed,
  CUP_RULES,
  getChannelGuides,
  rulesChannelName,
} from "./rules";

export type GuidePostStatus = "posted" | "skipped" | "missing" | "pin_failed";

export type GuidePostResult = {
  channelName: string;
  status: GuidePostStatus;
};

function findTextChannel(guild: Guild, name: string): TextChannel | null {
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

async function hasPinnedTitle(
  channel: TextChannel,
  botUserId: string,
  title: string,
): Promise<boolean> {
  const { items } = await channel.messages.fetchPins();
  for (const pin of items) {
    const msg = pin.message;
    if (msg.author.id === botUserId && msg.embeds[0]?.title === title) {
      return true;
    }
  }
  return false;
}

async function postAndPin(
  channel: TextChannel,
  botUserId: string,
  title: string,
  force: boolean,
  embed: ReturnType<typeof buildRulesEmbed>,
): Promise<GuidePostStatus> {
  if (!force && (await hasPinnedTitle(channel, botUserId, title))) {
    return "skipped";
  }
  const sent = await channel.send({ embeds: [embed] });
  try {
    await sent.pin();
    return "posted";
  } catch (error) {
    console.warn(`pin failed in #${channel.name}:`, error);
    return "pin_failed";
  }
}

export function autoPostChannelRulesEnabled(): boolean {
  const value = process.env.AUTO_POST_CHANNEL_RULES?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export async function postChannelGuides(
  guild: Guild,
  botUserId: string,
  options?: { force?: boolean },
): Promise<GuidePostResult[]> {
  const force = options?.force ?? false;
  const results: GuidePostResult[] = [];

  for (const guide of getChannelGuides()) {
    const channel = findTextChannel(guild, guide.channelName);
    if (!channel) {
      results.push({ channelName: guide.channelName, status: "missing" });
      continue;
    }
    const title = guide.embed.data.title ?? "";
    const status = await postAndPin(
      channel,
      botUserId,
      title,
      force,
      guide.embed,
    );
    results.push({ channelName: guide.channelName, status });
  }

  const generalName = rulesChannelName();
  const general = findTextChannel(guild, generalName);
  if (general) {
    const status = await postAndPin(
      general,
      botUserId,
      CUP_RULES.title,
      force,
      buildRulesEmbed(),
    );
    results.push({ channelName: `${generalName} (full rules)`, status });
  }

  return results;
}

export function formatGuideResults(results: GuidePostResult[]): string[] {
  return results.map((result) => {
    switch (result.status) {
      case "posted":
        return `✅ #${result.channelName} — guide pinned`;
      case "skipped":
        return `⏭️ #${result.channelName} — already pinned`;
      case "missing":
        return `❌ #${result.channelName} — channel not found`;
      case "pin_failed":
        return `⚠️ #${result.channelName} — posted but could not pin (need **Manage Messages**)`;
    }
  });
}
