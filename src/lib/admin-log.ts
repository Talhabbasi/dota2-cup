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

export async function listAdminActivityLogs(limit = 100) {
  try {
    return await prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 300),
    });
  } catch {
    return [];
  }
}
