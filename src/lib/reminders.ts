import type { Client, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { prisma } from "./prisma";
import { formatScheduleWhen } from "./schedule";
import { formatMatchTimesAllZones } from "./match-times";
import { weekendSlotLabel } from "./match-times";

export function reminderMinutesBefore(): number {
  const raw = process.env.REMINDER_MINUTES_BEFORE;
  const n = raw ? Number(raw) : 60;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

export function reminderChannelName(): string {
  return process.env.REMINDER_CHANNEL_NAME?.trim() || "general";
}

async function resolveGuildTextChannel(
  client: Client,
  channelName: string,
): Promise<TextChannel | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch();
  const match = channels.find(
    (ch) =>
      ch?.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === channelName.toLowerCase(),
  );
  return match?.type === ChannelType.GuildText ? match : null;
}

export async function tickMatchReminders(client: Client): Promise<void> {
  const leadMs = reminderMinutesBefore() * 60_000;
  const now = Date.now();
  const windowEnd = now + leadMs;

  const fixtures = await prisma.scheduledFixture.findMany({
    where: { status: "scheduled", reminderSent: false },
    include: {
      radiantTeam: true,
      direTeam: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (fixtures.length === 0) return;

  const channel = await resolveGuildTextChannel(client, reminderChannelName());
  if (!channel) return;

  for (const fixture of fixtures) {
    const at = fixture.scheduledAt.getTime();
    if (at <= now || at > windowEnd) continue;

    const [radiantCaptain, direCaptain] = await Promise.all([
      prisma.player.findFirst({
        where: { teamId: fixture.radiantTeamId, isCaptain: true },
      }),
      prisma.player.findFirst({
        where: { teamId: fixture.direTeamId, isCaptain: true },
      }),
    ]);

    const pings = [radiantCaptain?.discordId, direCaptain?.discordId]
      .filter(Boolean)
      .map((id) => `<@${id}>`);
    const pkt = formatScheduleWhen(fixture.scheduledAt);
    const day = weekendSlotLabel(fixture.slotIndex);
    const zones = formatMatchTimesAllZones(fixture.scheduledAt)
      .map((z) => `**${z.label}:** ${z.when}`)
      .join("\n");

    await channel.send({
      content: [
        pings.length ? pings.join(" ") : null,
        `⏰ **Match in ~${reminderMinutesBefore()} minutes**`,
        `**${day}** · ${pkt}`,
        `**${fixture.radiantTeam.name}** vs **${fixture.direTeam.name}**`,
        zones,
        "Queue on registered Steam accounts. Post `!result <match id>` in **#results** when done.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    await prisma.scheduledFixture.update({
      where: { id: fixture.id },
      data: { reminderSent: true },
    });
  }
}
