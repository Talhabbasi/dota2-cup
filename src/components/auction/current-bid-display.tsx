"use client";

import { TeamBadge } from "@/components/common";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export function CurrentBidDisplay({
  amount,
  teamName,
  teamId,
  className,
  size = "lg",
}: {
  amount: number;
  teamName?: string | null;
  teamId?: string | null;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-center",
        className,
      )}
    >
      <p className="m-0 text-[0.65rem] font-semibold tracking-[0.18em] text-primary uppercase">
        Current bid
      </p>
      <p
        key={`${teamId ?? "none"}-${amount}`}
        className={cn(
          "m-0 mt-1 font-mono font-bold tabular-nums text-primary animate-in zoom-in-95 fade-in duration-300",
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl",
        )}
      >
        {formatAuctionPoints(amount)}
        <span className="ml-2 font-sans text-sm font-semibold tracking-wide text-muted-foreground">
          pts
        </span>
      </p>
      <div className="mt-3 flex justify-center">
        {teamName ? (
          <TeamBadge name={teamName} size={size === "lg" ? "md" : "sm"} />
        ) : (
          <span className="text-sm text-muted-foreground">No bids yet</span>
        )}
      </div>
    </div>
  );
}
