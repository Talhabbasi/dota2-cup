import {
  BID_INCREMENT,
  MAX_ROSTER,
  ROLE_LABELS,
  formatPoints,
  labelForMedal,
  type PlayerRole,
} from "@/lib/constants";
import { formatRoles } from "@/lib/format";
import { parseRolesJson } from "@/lib/roles";
import type { WebAuctionView } from "@/lib/web-auction";

/** UI-facing auction lot status (maps from live session + waiting sold). */
export type AuctionUiStatus =
  | "waiting"
  | "live"
  | "paused"
  | "sold"
  | "unsold";

export type AuctionBidHistoryItem = {
  id: string;
  teamId: string;
  teamName: string;
  amount: number;
  at: number;
  highest: boolean;
};

export type AuctionPlayerNameFields = {
  steamName: string;
  pubgName?: string | null;
};

export function playerDisplayName(
  player: AuctionPlayerNameFields | null | undefined,
  game: string | null | undefined,
): string {
  if (!player) return "—";
  if (game === "PUBG") return player.pubgName || player.steamName;
  return player.steamName;
}

export function playerRoles(rolesJson: string | null | undefined): PlayerRole[] {
  if (!rolesJson) return [];
  return parseRolesJson(rolesJson);
}

export function playerRolesLabel(rolesJson: string | null | undefined): string {
  return formatRoles(playerRoles(rolesJson));
}

export function primarySecondaryRoles(rolesJson: string | null | undefined): {
  primary: string | null;
  secondary: string | null;
} {
  const roles = playerRoles(rolesJson);
  const primary = roles[0] ? ROLE_LABELS[roles[0]] ?? roles[0] : null;
  const secondary = roles[1] ? ROLE_LABELS[roles[1]] ?? roles[1] : null;
  return { primary, secondary };
}

export function deriveAuctionUiStatus(
  view: Pick<
    WebAuctionView,
    "status" | "currentPlayer" | "awaitingDecision" | "event" | "endsAt"
  >,
  closed: boolean,
): AuctionUiStatus {
  if (view.event === "sold") return "sold";
  if (view.event === "unsold") return "unsold";
  if (view.status === "paused") return "paused";
  if (view.status === "running" && !closed) return "live";
  if (view.status === "running" && closed) return "live";
  if (view.currentPlayer) return "waiting";
  return "waiting";
}

export function auctionStatusLabel(status: AuctionUiStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "sold":
      return "Sold";
    case "unsold":
      return "Unsold";
  }
}

export function minNextBid(view: Pick<WebAuctionView, "currentBid" | "highBidder">): number {
  if (!view.highBidder) {
    // Lots open at 0 — first placeable bid is the standard increment.
    return view.currentBid > 0 ? view.currentBid : BID_INCREMENT;
  }
  return view.currentBid + BID_INCREMENT;
}

export function rosterSlotsLeft(rosterCount: number): number {
  return Math.max(0, MAX_ROSTER - rosterCount);
}

export function formatAuctionPoints(n: number): string {
  return formatPoints(n);
}

export function medalDisplay(
  medal: string | null | undefined,
  medalLabel?: string | null,
): string {
  if (medalLabel) return medalLabel;
  if (!medal) return "—";
  return labelForMedal(medal);
}

export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function formatBidTime(at: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(at));
  } catch {
    return "—";
  }
}
