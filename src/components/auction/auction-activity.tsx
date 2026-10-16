"use client";

import { AnimatePresence, motion } from "motion/react";
import { EsportsCard } from "@/components/common";
import { displayTeamName } from "@/components/auction/team-purse-strip";
import { formatAuctionPoints } from "@/lib/auction-ui";
import type { AuctionBidHistoryItem } from "@/lib/auction-ui";
import type { WebAuctionView } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

export function AuctionActivity({
  view,
  latestBid,
  className,
}: {
  view: WebAuctionView;
  latestBid?: AuctionBidHistoryItem | null;
  className?: string;
}) {
  let line = "Waiting for the next paddle raise.";

  if (view.event === "sold" && view.lastSale?.teamName) {
    line = `${displayTeamName(view.lastSale.teamName)} closed the deal at ${formatAuctionPoints(view.lastSale.price ?? 0)} pts.`;
  } else if (view.event === "unsold" && view.lastSale) {
    line = `${view.lastSale.playerName} went unsold.`;
  } else if (latestBid) {
    line = `${displayTeamName(latestBid.teamName)} raised to ${formatAuctionPoints(latestBid.amount)} pts.`;
  } else if (view.status === "paused") {
    line = "Auction paused by the organizer.";
  } else if (view.status === "idle") {
    line = "Auction idle — waiting for the next lot.";
  } else if (view.currentPlayer && !view.highBidder) {
    line = "Lot is open. Waiting for the opening bid.";
  }

  return (
    <EsportsCard interactive={false} className={cn("overflow-hidden p-0", className)}>
      <header className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5">
        <h3 className="m-0 font-display text-sm tracking-[0.14em] text-amber-300 uppercase">
          Activity
        </h3>
        <p className="mt-1 mb-0 text-[0.65rem] text-muted-foreground">
          Live call-out for this lot
        </p>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={line}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
          className="m-0 px-4 py-4 text-sm leading-relaxed text-foreground"
          role="status"
        >
          {line}
        </motion.p>
      </AnimatePresence>
    </EsportsCard>
  );
}
