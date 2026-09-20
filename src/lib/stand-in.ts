export function isMatchStandIn(input: {
  side: string;
  unknown?: boolean;
  playerTeamId?: string | null;
  radiantTeamId?: string | null;
  direTeamId?: string | null;
}): boolean {
  if (input.unknown || !input.playerTeamId) return true;
  const sideTeamId =
    input.side === "dire" ? input.direTeamId : input.radiantTeamId;
  if (!sideTeamId) return false;
  return input.playerTeamId !== sideTeamId;
}

export function unregisteredStandInLabel(
  boardName?: string | null,
  steam32?: number,
) {
  const name = boardName?.trim();
  if (name) return `${name} (stand-in)`;
  if (steam32) return `Unknown ${steam32} (stand-in)`;
  return "Unknown (stand-in)";
}
