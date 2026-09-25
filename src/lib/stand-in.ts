/**
 * Match scoreboard / stand-in labels.
 * Unmatched = OCR miss, needs admin link.
 * Stand-in = guest / wrong team for the side, or admin-marked guest.
 */

export function isMatchUnmatched(input: {
  unknown?: boolean;
  asStandIn?: boolean;
  playerId?: string | null;
}): boolean {
  if (input.asStandIn) return false;
  return Boolean(input.unknown) || !input.playerId;
}

export function isMatchStandIn(input: {
  side: string;
  unknown?: boolean;
  asStandIn?: boolean;
  playerId?: string | null;
  /** Roster team for the match's season (prefer SeasonPlayer.teamId). */
  playerTeamId?: string | null;
  radiantTeamId?: string | null;
  direTeamId?: string | null;
}): boolean {
  if (input.asStandIn) return true;
  if (isMatchUnmatched(input)) return false;
  if (!input.playerTeamId) return true;
  const sideTeamId =
    input.side === "dire" ? input.direTeamId : input.radiantTeamId;
  if (!sideTeamId) return false;
  return input.playerTeamId !== sideTeamId;
}

export function unmatchedLabel(boardName?: string | null, steam32?: number) {
  const name = boardName?.trim();
  if (name) return `${name} (unmatched)`;
  if (steam32) return `Unknown ${steam32} (unmatched)`;
  return "Unknown (unmatched)";
}

export function standInLabel(boardName?: string | null, steam32?: number) {
  const name = boardName?.trim();
  if (name) return `${name} (stand-in)`;
  if (steam32) return `Unknown ${steam32} (stand-in)`;
  return "Unknown (stand-in)";
}

/** @deprecated Prefer unmatchedLabel / standInLabel. */
export function unregisteredStandInLabel(
  boardName?: string | null,
  steam32?: number,
) {
  return unmatchedLabel(boardName, steam32);
}
