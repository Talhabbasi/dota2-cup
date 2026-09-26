import type { Session } from "next-auth";
import { prisma } from "./prisma";

export type AdminLogInput = {
  action: string;
  summary: string;
  meta?: Record<string, unknown>;
  /** Override when logging from Discord bot (no NextAuth session). */
  actorDiscordId?: string;
  actorName?: string;
};

/** Human labels for stored action codes. */
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "match.link_player": "Linked player",
  "match.stand_in": "Marked stand-in",
  "match.stand_out": "Cleared stand-in",
  "match.set_result": "Set match result",
  "match.ingest_scoreboard": "Uploaded scoreboard",
  "match.attach_screenshot": "Attached screenshot",
  "player.register": "Registered player",
  "player.update": "Updated player",
  "player.roster_slot": "Changed roster slot",
  "player.alias": "Added alias",
  "team.add_player": "Added to team",
  "team.remove_player": "Removed from team",
  "team.add_captain": "Set captain",
  "team.change_captain": "Changed captain",
  "team.rename": "Renamed team",
  "team.remove_captain": "Removed captain",
  "schedule.create": "Booked fixture",
  "schedule.update": "Updated fixture",
  "schedule.delete": "Deleted fixture",
  "schedule.walkover": "Walkover",
  "schedule.winner": "Recorded winner",
  "auction.sold_price": "Set auction price",
  "cup.switches": "Cup switches",
  "payment.mark": "Marked paid",
  "payment.clear": "Cleared payment",
};

export function adminActionLabel(action: string) {
  if (ADMIN_ACTION_LABELS[action]) return ADMIN_ACTION_LABELS[action];
  return action
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Steam / Discord display name for a discord id (season-suffixed ok). */
export async function playerDisplayName(
  discordId: string | null | undefined,
): Promise<string | null> {
  const raw = discordId?.trim();
  if (!raw) return null;
  const base = raw.split(":")[0];
  const player = await prisma.player.findFirst({
    where: {
      OR: [{ discordId: raw }, { discordId: { startsWith: `${base}:` } }],
    },
    select: { steamName: true, discordName: true },
  });
  const name = player?.steamName?.trim() || player?.discordName?.trim();
  return name || null;
}

function actorFromSession(session: Session | null | undefined) {
  const user = session?.user;
  const discordId =
    user?.discordId?.trim() ||
    (user as { id?: string } | undefined)?.id?.trim() ||
    "unknown";
  const name =
    user?.name?.trim() ||
    (discordId !== "unknown" ? `Discord ${discordId}` : "Admin");
  return { discordId, name };
}

/** Persist one admin activity row. Never throws to callers. */
export async function logAdminActivity(
  sessionOrNull: Session | null | undefined,
  input: AdminLogInput,
) {
  try {
    const fromSession = actorFromSession(sessionOrNull);
    const actorDiscordId = input.actorDiscordId?.trim() || fromSession.discordId;
    const actorName = input.actorName?.trim() || fromSession.name;
    await prisma.adminActivityLog.create({
      data: {
        actorDiscordId,
        actorName,
        action: input.action.slice(0, 80),
        summary: input.summary.slice(0, 500),
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (error) {
    console.warn("admin activity log failed:", error);
  }
}

export type AdminActivityLogView = {
  id: string;
  createdAt: Date;
  actorName: string;
  actorDiscordId: string;
  action: string;
  actionLabel: string;
  summary: string;
  matchId: string | null;
};

function metaObject(metaJson: string | null): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function listAdminActivityLogs(
  limit = 100,
): Promise<AdminActivityLogView[]> {
  try {
    const rows = await prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 300),
    });

    const mentionIds = new Set<string>();
    const playerIds = new Set<string>();
    const matchIds = new Set<string>();

    for (const row of rows) {
      for (const m of row.summary.matchAll(/<@(\d+)>/g)) {
        mentionIds.add(m[1]);
      }
      const meta = metaObject(row.metaJson);
      const discordId = meta.discordId;
      if (typeof discordId === "string" && discordId.trim()) {
        mentionIds.add(discordId.split(":")[0]);
      }
      const playerId = meta.playerId;
      if (typeof playerId === "string" && playerId.trim()) {
        playerIds.add(playerId);
      }
      const matchId = meta.matchId;
      if (typeof matchId === "string" && matchId.trim()) {
        matchIds.add(matchId);
      }
    }

    const [byDiscord, byPlayerId, matches] = await Promise.all([
      mentionIds.size
        ? prisma.player.findMany({
            where: {
              OR: [...mentionIds].flatMap((id) => [
                { discordId: id },
                { discordId: { startsWith: `${id}:` } },
              ]),
            },
            select: { discordId: true, steamName: true, discordName: true },
          })
        : Promise.resolve([]),
      playerIds.size
        ? prisma.player.findMany({
            where: { id: { in: [...playerIds] } },
            select: { id: true, steamName: true, discordName: true },
          })
        : Promise.resolve([]),
      matchIds.size
        ? prisma.match.findMany({
            where: { id: { in: [...matchIds] } },
            select: {
              id: true,
              radiantScore: true,
              direScore: true,
              radiantTeam: { select: { name: true } },
              direTeam: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const nameByDiscord = new Map<string, string>();
    for (const p of byDiscord) {
      const label = p.steamName?.trim() || p.discordName?.trim();
      if (!label) continue;
      nameByDiscord.set(p.discordId.split(":")[0], label);
    }
    const nameByPlayerId = new Map<string, string>();
    for (const p of byPlayerId) {
      const label = p.steamName?.trim() || p.discordName?.trim();
      if (label) nameByPlayerId.set(p.id, label);
    }
    const matchLabel = new Map<string, string>();
    for (const m of matches) {
      const a = m.radiantTeam?.name ?? "Radiant";
      const b = m.direTeam?.name ?? "Dire";
      const score =
        m.radiantScore != null && m.direScore != null
          ? ` ${m.radiantScore}–${m.direScore}`
          : "";
      matchLabel.set(m.id, `${a} vs ${b}${score}`);
    }

    return rows.map((row) => {
      const meta = metaObject(row.metaJson);
      let summary = row.summary.replace(
        /<@(\d+)>/g,
        (_, id: string) => nameByDiscord.get(id) ?? `Discord ${id}`,
      );

      // Enrich vague older rows when meta has ids.
      if (
        row.action === "match.link_player" &&
        /Linked scoreboard seat to player/i.test(summary)
      ) {
        const board =
          typeof meta.boardName === "string" ? meta.boardName.trim() : "";
        const playerId =
          typeof meta.playerId === "string" ? meta.playerId : "";
        const player = playerId ? nameByPlayerId.get(playerId) : null;
        if (board && player) {
          summary = `Linked “${board}” → ${player}`;
        } else if (player) {
          summary = `Linked seat → ${player}`;
        }
      }

      if (
        row.action === "match.ingest_scoreboard" &&
        typeof meta.matchId === "string"
      ) {
        const label = matchLabel.get(meta.matchId);
        if (label) summary = `Uploaded scoreboard: ${label}`;
      }

      if (
        row.action === "match.attach_screenshot" &&
        typeof meta.matchId === "string"
      ) {
        const label = matchLabel.get(meta.matchId);
        if (label) summary = `Attached screenshot: ${label}`;
      }

      const matchId =
        typeof meta.matchId === "string" && meta.matchId.trim()
          ? meta.matchId
          : null;

      return {
        id: row.id,
        createdAt: row.createdAt,
        actorName: row.actorName,
        actorDiscordId: row.actorDiscordId,
        action: row.action,
        actionLabel: adminActionLabel(row.action),
        summary,
        matchId,
      };
    });
  } catch {
    return [];
  }
}
