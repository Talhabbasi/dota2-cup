"use client";

import { useEffect, useRef, useState } from "react";
import { AuctionActivity } from "@/components/auction/auction-activity";
import { AuctionSaleCelebration } from "@/components/auction/auction-sale-celebration";
import { AuctionHeader } from "@/components/auction/auction-layout";
import { AuctionLotStage } from "@/components/auction/auction-lot-stage";
import { BidHistory } from "@/components/auction/bid-history";
import { CaptainTeamRoster } from "@/components/auction/captain-team-roster";
import { TeamBudgetOverview } from "@/components/auction/team-budget-card";
import { UpcomingPlayersRail } from "@/components/auction/upcoming-players-rail";
import { useBidHistory } from "@/components/auction/use-bid-history";
import { useAuctionView } from "@/components/use-auction-view";
import {
  deriveAuctionUiStatus,
  playerDisplayName,
} from "@/lib/auction-ui";
import type { AuctionBidHistoryItem } from "@/lib/auction-ui";
import type { WebAuctionView } from "@/lib/web-auction";

export function LiveAuctionRoom({
  initial,
  canBid = false,
  teamId = null,
  seedBids = [],
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
  const live = useAuctionView(initial);
  const view = live.view;
  const accept = live.accept;
  const connected = live.connected;
  const secondsLeft = live.secondsLeft;
  const closed = live.closed;

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState<{
    lotId: string;
    amount: number;
    requestId: string;
  } | null>(null);
  const submitting = useRef(false);
  const bids = useBidHistory(view, seedBids);
  const status = deriveAuctionUiStatus(view, closed);

  useEffect(() => {
    onView?.(view, connected, accept);
  }, [view, connected, accept, onView]);

  async function bid(amount?: number) {
    if (
      submitting.current ||
      !connected ||
      (!uncertain && (closed || !view.lotId || amount === undefined))
    ) {
      return;
    }
    const payload =
      uncertain ??
      ({
        lotId: view.lotId!,
        amount: amount!,
        requestId: crypto.randomUUID(),
      } as const);
    submitting.current = true;
    setPending(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/auction/bid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (res.status >= 500) setUncertain(payload);
        else setUncertain(null);
        setError(json.error ?? "Bid failed. Refresh the auction.");
        return;
      }
      setUncertain(null);
      if (json.view) accept(json.view);
    } catch (error) {
      setUncertain(payload);
      const detail = error instanceof Error ? error.message.trim() : "";
      setError(
        detail && !/aborted/i.test(detail)
          ? `Connection interrupted. ${detail}`
          : "Connection interrupted. The bid request timed out — check the result using the same bid.",
      );
    } finally {
      clearTimeout(timeout);
      submitting.current = false;
      setPending(false);
    }
  }

  const myTeam = teamId
    ? view.teamBalances.find((t) => t.id === teamId)
    : undefined;

  return (
    <div className="grid min-w-0 gap-5 overflow-x-hidden">
      <AuctionSaleCelebration sale={view.lastSale} />
      <AuctionHeader
        title="Live auction"
        connected={connected}
        problem={live.problem}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(220px,0.95fr)_minmax(0,1.35fr)_minmax(260px,0.9fr)] xl:items-stretch">
        <AuctionLotStage
          view={view}
          player={view.currentPlayer}
          status={status}
          secondsLeft={secondsLeft}
          timerRunning={view.status === "running" && !!view.endsAt}
          timerPaused={view.status === "paused"}
          canBid={canBid}
          teamId={teamId}
          teamPurse={myTeam?.purse}
          connected={connected}
          closed={closed}
          pending={pending}
          error={error}
          uncertain={uncertain}
          onBid={(amount) => void bid(amount)}
          onRetryUncertain={() => void bid()}
        />

        <aside className="flex min-w-0 flex-col gap-4">
          <BidHistory bids={bids} className="min-h-[16rem] flex-1" />
          <AuctionActivity view={view} latestBid={bids[0] ?? null} />
        </aside>
      </div>

      <TeamBudgetOverview
        teams={view.teamBalances}
        leadingTeamId={view.highBidder?.id}
      />

      {myTeam ? (
        <CaptainTeamRoster
          teamName={myTeam.name}
          purse={myTeam.purse}
          rosterCount={myTeam.rosterCount}
          players={myTeam.players}
          leading={view.highBidder?.id === myTeam.id}
        />
      ) : null}

      <UpcomingPlayersRail
        upcoming={view.upcoming}
        currentName={
          view.currentPlayer
            ? playerDisplayName(view.currentPlayer, view.game)
            : null
        }
      />
    </div>
  );
}
