import {
  ChannelType,
  EmbedBuilder,
  type Guild,
} from "discord.js";
import { cupSiteUrl } from "./channel-moderation";
import { ensureMatchesChannel } from "./cup-announcements";
import {
  type BookedGroupMatch,
} from "./group-stage-schedule";
import { lockRegisteredPlayerChannels } from "./payments-channel-access";
import { formatScheduleWhen } from "./schedule";

const GOLD = 0xb07d1f;

export const GROUP_STAGE_POST_TITLE = "Group stage — round robin";

export function groupStageScheduleEmbeds(result: {
  saturday: string;
  sunday: string;
  fixtures: BookedGroupMatch[];
}) {
  const groupA = result.fixtures.filter((row) => row.group === "A");
  const groupB = result.fixtures.filter((row) => row.group === "B");
  const site = cupSiteUrl();

  const dayEmbed = (title: string, matches: BookedGroupMatch[]) =>
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(title)
      .setDescription(
        matches
          .map(
            (match) =>
              `**Match ${match.matchNumber}** — ${match.teamA} vs ${match.teamB}\n${formatScheduleWhen(match.scheduledAt)} · Bo1`,
          )
          .join("\n\n"),
      );

  return [
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(GROUP_STAGE_POST_TITLE)
      .setDescription(
        [
          "8 teams · 2 groups of 4 · single round-robin · **Bo1**.",
          "Each team plays **3** matches. Group A is Saturday; Group B is Sunday.",
          "Kickoff slots: 10:00 PM → 4:00 AM PKT (1 hour between games).",
          "",
          `Full grid: **${site}/schedule**`,
        ].join("\n"),
      ),
    dayEmbed(`Day 1 — Saturday ${result.saturday} — Group A`, groupA),
    dayEmbed(`Day 2 — Sunday ${result.sunday} — Group B`, groupB),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("10:00 PM–12:00 AM requests")
      .setDescription(
        [
          "**Prodandy** → Team Chessman (Group A)",
          "**INVOKER** → Team Ash (Group B)",
          "**Dendi The Main Culprit !** → Team Saif (Group B)",
          "",
          "Each of them plays 3 group games, and a night only has 3 slots from 10 PM–12 AM. Putting all 3 games in that window would force back-to-back matches.",
          "",
          "Closest fit: **2 of 3** games in 10 PM–12 AM, with 2 hours rest before the third.",
          "Chessman / Ash: 10:00 PM, 12:00 AM, then 2:00 AM.",
          "Saif: 11:00 PM, 12:00 AM (vs Ash), then 3:00 AM.",
        ].join("\n"),
      ),
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
