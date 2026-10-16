"use client";

import { LiveAuctionRoom } from "@/components/auction/live-auction-room";
import type { AuctionBidHistoryItem } from "@/lib/auction-ui";
import type { WebAuctionView } from "@/lib/web-auction";

/** Public live auction board — AuctionBazi-inspired layout on MM Dota Cup theme. */
export function LiveAuctionBoard({
  initial,
  canBid = false,
  teamId = null,
  seedBids,
  onView,
}: {
  initial: WebAuctionView;
  canBid?: boolean;
  teamId?: string | null;
  seedBids?: AuctionBidHistoryItem[];
  onView?: (
    view: WebAuctionView,
    connected: boolean,
    accept: (next: WebAuctionView) => void,
  ) => void;
}) {
  return (
    <LiveAuctionRoom
      initial={initial}
      canBid={canBid}
      teamId={teamId}
      seedBids={seedBids}
      onView={onView}
    />
  );
}
