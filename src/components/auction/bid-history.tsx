"use client";

import { AnimatePresence, motion } from "motion/react";
import { TeamBadge } from "@/components/common";
import { EsportsCard } from "@/components/common";
import { displayTeamName } from "@/components/auction/team-purse-strip";
import {
  formatAuctionPoints,
  formatBidTime,
  type AuctionBidHistoryItem,
} from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export function BidHistoryItem({
  bid,
  className,
}: {
  bid: AuctionBidHistoryItem;
  className?: string;
}) {
  const label = displayTeamName(bid.teamName);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex items-start gap-3 border-b border-white/6 px-3 py-3 last:border-0",
        bid.highest && "border-l-2 border-l-emerald-400 bg-emerald-500/8",
        className,
      )}
    >
      <TeamBadge name={label} size="sm" showName={false} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold leading-snug break-words text-foreground">
          {label}
        </p>
        <p className="m-0 mt-0.5 text-[0.68rem] text-muted-foreground">
          {formatBidTime(bid.at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <motion.p
          key={bid.amount}
          initial={{ scale: 1.08, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "m-0 font-mono text-sm font-bold tabular-nums",
            bid.highest ? "text-emerald-300" : "text-foreground",
          )}
        >
          {formatAuctionPoints(bid.amount)}
        </motion.p>
        {bid.highest ? (
          <p className="m-0 text-[0.6rem] font-semibold tracking-wide text-emerald-400 uppercase">
            Latest
          </p>
        ) : null}
      </div>
    </motion.li>
  );
}

export function BidHistory({
  bids,
  className,
  fill,
  emptyLabel = "No raises yet. Live bids appear here as captains raise.",
}: {
  bids: AuctionBidHistoryItem[];
  className?: string;
  /** Drop the fixed cap from this breakpoint up and scroll inside the matched card. */
  fill?: "lg" | "xl";
  emptyLabel?: string;
}) {
  return (
    <EsportsCard
      interactive={false}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0",
        className,
      )}
    >
      <header className="border-b border-pink-400/20 bg-pink-500/10 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="m-0 font-display text-sm tracking-[0.12em] text-pink-200 uppercase">
            Live bid history
          </h3>
          {bids.length > 0 ? (
            <span className="font-mono text-[0.65rem] tabular-nums text-pink-200/70">
              {bids.length}
            </span>
          ) : null}
        </div>
      </header>
      {bids.length === 0 ? (
        <p className="m-0 flex flex-1 items-center px-4 py-8 text-sm leading-relaxed text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul
          className={cn(
            "m-0 max-h-[22rem] min-h-0 flex-1 list-none overflow-y-auto overscroll-contain p-0",
            fill === "lg" && "lg:max-h-none",
            fill === "xl" && "xl:max-h-none",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {bids.map((bid) => (
              <BidHistoryItem key={bid.id} bid={bid} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </EsportsCard>
  );
}
