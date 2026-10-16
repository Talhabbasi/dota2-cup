import { prisma } from "@/lib/prisma";

/** Prefer a stored Discord CDN URL; otherwise the default colored Discord avatar. */
export function resolveDiscordAvatarUrl(
  discordId: string | null | undefined,
  storedUrl?: string | null,
): string | null {
  if (storedUrl?.trim()) return storedUrl.trim();
  if (!discordId) return null;
  const snowflake = discordId.split(":")[0]?.trim() ?? "";
  if (!/^\d+$/.test(snowflake)) return null;
  try {
    const index = Number((BigInt(snowflake) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return null;
  }
}

/** Persist avatar when a registered player signs in with Discord (or re-/registers). */
export async function syncPlayerDiscordAvatar(
  discordId: string,
  imageUrl: string | null | undefined,
) {
  const url = imageUrl?.trim();
  if (!discordId || !url) return;
  await prisma.player.updateMany({
    where: {
      OR: [
        { discordId },
        { discordId: { startsWith: `${discordId}:` } },
      ],
    },
    data: { discordAvatarUrl: url },
  });
}
