/**
 * Stand-in is per player, per match, per team they represented.
 * A global asStandIn flag must not mark their own-team games.
 * Unmatched = OCR miss, needs admin link.
 */

import { normalizeAlias } from "./player-aliases";

export type AppearanceKind = "regular" | "standin" | "unmatched" | "review";

export function representedTeamId(
  side: string,
  radiantTeamId?: string | null,
  direTeamId?: string | null,
): string | null {
  if (side === "dire") return direTeamId ?? null;
  if (side === "radiant") return radiantTeamId ?? null;
  return null;
}

/**
 * Own-team games are regular even if a leaked flag says stand-in.
 * Another team is stand-in for that match only.
 * Missing roster team is review — not stand-in on every match.
 */
export function classifySeatAppearance(input: {
  playerId?: string | null;
  unknown?: boolean;
  asStandIn?: boolean;
  /** Season roster team for this match's season. Not the player's current team. */
  originalTeamId?: string | null;
  representedTeamId?: string | null;
}): AppearanceKind {
  const linked = Boolean(input.playerId) && !input.unknown;
  if (!linked) {
    return input.asStandIn ? "standin" : "unmatched";
  }
  const original = input.originalTeamId ?? null;
  const represented = input.representedTeamId ?? null;
  if (original && represented) {
    return original === represented ? "regular" : "standin";
  }
  if (input.asStandIn && !original) return "standin";
  return "review";
}

/** null = leave the stored flag alone (ambiguous). */
export function plannedStandInFlag(input: {
  playerId?: string | null;
  unknown?: boolean;
  asStandIn?: boolean;
  originalTeamId?: string | null;
  representedTeamId?: string | null;
}): boolean | null {
  const kind = classifySeatAppearance(input);
  if (kind === "regular") return false;
  if (kind === "standin") return true;
  return null;
}

export function isMatchUnmatched(input: {
  unknown?: boolean;
  asStandIn?: boolean;
  playerId?: string | null;
}): boolean {
  return classifySeatAppearance(input) === "unmatched";
}

export function isMatchStandIn(input: {
  side: string;
  unknown?: boolean;
  asStandIn?: boolean;
  playerId?: string | null;
  /** Roster team for the match's season (SeasonPlayer.teamId only). */
  playerTeamId?: string | null;
  radiantTeamId?: string | null;
  direTeamId?: string | null;
}): boolean {
  return (
    classifySeatAppearance({
      playerId: input.playerId,
      unknown: input.unknown,
      asStandIn: input.asStandIn,
      originalTeamId: input.playerTeamId,
      representedTeamId: representedTeamId(
        input.side,
        input.radiantTeamId,
        input.direTeamId,
      ),
    }) === "standin"
  );
}

export type InsightGroup = {
  kind: "roster" | "standin";
  key: string;
  name: string;
  teamName: string | null;
};

export function standInInsightName(
  playerName: string,
  teamName: string | null,
) {
  const who = playerName.trim() || "Stand-in";
  const team = teamName?.trim() || "another team";
  return `${who} - ${team} (Stand-In)`;
}

/**
 * Regular key: player + original team.
 * Stand-in key: player + the team they represented.
 * Review and unmatched seats are left out so kills are not mixed.
 */
export function insightGroupForSeat(input: {
  playerId?: string | null;
  playerName?: string | null;
  boardName?: string | null;
  unknown?: boolean;
  asStandIn?: boolean;
  originalTeamId?: string | null;
  originalTeamName?: string | null;
  representedTeamId?: string | null;
  representedTeamName?: string | null;
}): InsightGroup | null {
  const kind = classifySeatAppearance({
    playerId: input.playerId,
    unknown: input.unknown,
    asStandIn: input.asStandIn,
    originalTeamId: input.originalTeamId,
    representedTeamId: input.representedTeamId,
  });
  if (kind !== "regular" && kind !== "standin") return null;

  const playerName =
    input.playerName?.trim() || input.boardName?.trim() || "Stand-in";
  if (kind === "regular") {
    const teamId = input.originalTeamId ?? "none";
    return {
      kind: "roster",
      key: `roster:${input.playerId}:${teamId}`,
      name: playerName,
      teamName: input.originalTeamName ?? input.representedTeamName ?? null,
    };
  }

  const teamName = input.representedTeamName ?? null;
  const teamKey = (
    input.representedTeamId ??
    teamName ??
    "none"
  ).toLowerCase();
  const identity = input.playerId
    ? `pid:${input.playerId}`
    : `name:${normalizeAlias(playerName) || playerName.toLowerCase()}`;
  return {
    kind: "standin",
    key: `standin:${identity}:${teamKey}`,
    name: standInInsightName(playerName, teamName),
    teamName,
  };
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
