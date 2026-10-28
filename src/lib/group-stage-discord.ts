import {
  ChannelType,
  EmbedBuilder,
  type Guild,
} from "discord.js";
import { cupSiteUrl } from "./channel-moderation";
import { ensureMatchesChannel } from "./cup-announcements";
import {
  groupStageRoundBlocks,
  type BookedGroupMatch,
} from "./group-stage-schedule";
import { lockRegisteredPlayerChannels } from "./payments-channel-access";

const GOLD = 0xb07d1f;

export const GROUP_STAGE_POST_TITLE = "Group stage — round robin";

export function groupStageScheduleEmbeds(result: {
  saturday: string;
  sunday: string;
  fixtures: BookedGroupMatch[];
}) {
  const site = cupSiteUrl();
  const blocks = groupStageRoundBlocks(result.fixtures);
  const roundEmbeds: EmbedBuilder[] = [];
  let chunk: string[] = [];
  let size = 0;
  const flush = (index: number) => {
    if (chunk.length === 0) return;
    roundEmbeds.push(
      new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(index === 0 ? "Rounds — both groups" : "Rounds — continued")
        .setDescription(chunk.join("\n\n")),
    );
    chunk = [];
    size = 0;
  };
  for (const block of blocks) {
    if (size + block.length + 2 > 3900) flush(roundEmbeds.length);
    chunk.push(block);
    size += block.length + 2;
  }
  flush(roundEmbeds.length);

  return [
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(GROUP_STAGE_POST_TITLE)
      .setDescription(
        [
          "Teams · 2 equal groups · single round-robin · **Bo1**.",
          "Group A and Group B start at the same time. Each team plays every other team in its group once.",
          "One round per hour from 10:00 PM PKT. An odd group sits one team per round, and that bye rotates.",
          "",
          `Full grid: **${site}/schedule**`,
        ].join("\n"),
      ),
    ...roundEmbeds,
  ];
}

export async function postGroupStageToMatches(
  guild: Guild,
  result: {
    saturday: string;
    sunday: string;
    fixtures: BookedGroupMatch[];
  },
  options?: { botUserId?: string; force?: boolean },
) {
  const channel = await ensureMatchesChannel(guild);
  await lockRegisteredPlayerChannels(guild);

  if (options?.botUserId && !options.force && channel.type === ChannelType.GuildText) {
    const { items } = await channel.messages.fetchPins();
    for (const pin of items) {
      const msg = pin.message;
      if (
        msg.author.id === options.botUserId &&
        msg.embeds[0]?.title === GROUP_STAGE_POST_TITLE
      ) {
        return { posted: false, channel };
      }
    }
  }

  const sent = await channel.send({
    embeds: groupStageScheduleEmbeds(result),
  });
  try {
    await sent.pin();
  } catch (error) {
    console.warn(
      `Could not pin group schedule in #${channel.name}:`,
      error instanceof Error ? error.message : error,
    );
  }
  return { posted: true, channel };
}
