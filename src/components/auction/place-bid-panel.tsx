"use client";

import { Button } from "@/components/ui/button";
import { EsportsCard } from "@/components/common";
import {
  formatAuctionPoints,
  minNextBid,
} from "@/lib/auction-ui";
import { BID_INCREMENT } from "@/lib/constants";
import type { WebAuctionView } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

export type BidUiState =
  | "default"
  | "loading"
  | "submitted"
  | "accepted"
  | "rejected"
  | "insufficient"
  | "paused"
  | "ended"
  | "holding";

const BID_STEPS = [BID_INCREMENT, 500, 5000] as const;

export function PlaceBidPanel({
  view,
  teamId,
  teamPurse,
  connected,
  closed,
  pending,
  error,
  uncertain,
  onBid,
  onRetryUncertain,
  className,
}: {
  view: WebAuctionView;
  teamId: string;
  teamPurse: number;
  connected: boolean;
  closed: boolean;
  pending: boolean;
  error: string | null;
  uncertain: { lotId: string; amount: number; requestId: string } | null;
  onBid: (amount: number) => void;
  onRetryUncertain: () => void;
  className?: string;
}) {
  const youAreHigh = view.highBidder?.id === teamId;
  const nextMin = minNextBid(view);
  const idle = view.status === "idle";
  const paused = view.status === "paused";

  let state: BidUiState = "default";
  if (pending) state = "loading";
  else if (uncertain) state = "submitted";
  else if (!connected) state = "rejected";
  else if (idle || closed) state = "ended";
  else if (paused) state = "paused";
  else if (youAreHigh) state = "holding";
  else if (nextMin > teamPurse) state = "insufficient";
  else if (error) state = "rejected";

  function requestBid(amount: number) {
    if (amount > teamPurse) return;
    onBid(amount);
  }

  return (
    <EsportsCard
      interactive={false}
      className={cn("border-primary/25 bg-primary/5 p-4", className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Captain desk
          </p>
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            High bid{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatAuctionPoints(view.currentBid)}
            </span>
            {" · "}
            Min next{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatAuctionPoints(nextMin)}
            </span>
          </p>
        </div>
        <p className="m-0 font-mono text-sm tabular-nums">
          Purse{" "}
          <strong className="text-primary">{formatAuctionPoints(teamPurse)}</strong>
        </p>
      </div>

      {uncertain ? (
        <Button
          type="button"
          size="lg"
          disabled={pending || !connected}
          onClick={onRetryUncertain}
          className="mt-4 h-12 w-full text-base font-semibold"
          variant="default"
        >
          {pending ? "Checking…" : "Check previous bid"}
        </Button>
      ) : state === "holding" ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-200"
          role="status"
        >
          Your team holds the highest bid
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {BID_STEPS.map((step, index) => {
            const opening = !view.highBidder && step === BID_INCREMENT;
            const amount = opening ? nextMin : view.currentBid + step;
            const tooMuch = amount > teamPurse;
            const disabled =
              pending ||
              !connected ||
              idle ||
              view.status !== "running" ||
              closed ||
              tooMuch ||
              !view.lotId;

            return (
              <Button
                key={step}
                type="button"
                size="lg"
                disabled={disabled}
                onClick={() => requestBid(amount)}
                variant={index === 0 ? "default" : "outline"}
                className={cn(
                  "h-12 text-base font-semibold",
                  index === 0 &&
                    "bg-primary text-primary-foreground hover:bg-primary/85",
                  tooMuch && "opacity-40",
                )}
              >
                {pending && index === 0
                  ? "Bidding…"
                  : opening
                    ? `Place bid ${formatAuctionPoints(amount)}`
                    : `+${formatAuctionPoints(step)} → ${formatAuctionPoints(amount)}`}
              </Button>
            );
          })}
        </div>
      )}

      <p className="mt-3 mb-0 text-[0.72rem] text-muted-foreground">
        Increment {formatAuctionPoints(BID_INCREMENT)} pts
        {state === "paused"
          ? " · Auction paused"
          : state === "ended"
            ? " · Auction not open for bids"
            : state === "insufficient"
              ? " · Insufficient budget for the next bid"
              : !connected
                ? " · Reconnecting — bidding paused"
                : null}
      </p>

      {error ? (
        <p className="mt-2 mb-0 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </EsportsCard>
  );
}
