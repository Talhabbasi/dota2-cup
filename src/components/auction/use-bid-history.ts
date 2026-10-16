"use client";

import { useEffect, useRef, useState } from "react";
import type { AuctionBidHistoryItem } from "@/lib/auction-ui";
import type { WebAuctionView } from "@/lib/web-auction";

/**
 * Client-side bid feed derived from live auction polls.
 * The backend view does not expose a full bid log; this reconstructs
 * history from high-bidder / amount changes for the active lot.
 */
export function useBidHistory(
  view: WebAuctionView,
  seed: AuctionBidHistoryItem[] = [],
): AuctionBidHistoryItem[] {
  const [bids, setBids] = useState<AuctionBidHistoryItem[]>(seed);
  const lotRef = useRef<string | null>(view.lotId);
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (view.lotId !== lotRef.current) {
      lotRef.current = view.lotId;
      lastKey.current = "";
      setBids([]);
    }

    if (!view.highBidder || !view.lotId || view.currentBid <= 0) return;

    const key = `${view.lotId}:${view.highBidder.id}:${view.currentBid}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    setBids((prev) => {
      const next: AuctionBidHistoryItem = {
        id: key,
        teamId: view.highBidder!.id,
        teamName: view.highBidder!.name,
        amount: view.currentBid,
        at: Date.now(),
        highest: true,
      };
      return [
        next,
        ...prev.map((b) => ({ ...b, highest: false })),
      ].slice(0, 40);
    });
  }, [view.lotId, view.highBidder, view.currentBid]);

  return bids;
}
