"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AuctionControls,
  AuctionPlayerQueue,
  AuctionStatistics,
  BidHistory,
  CurrentPlayerCard,
  TeamBudgetOverview,
} from "@/components/auction";
import { useBidHistory } from "@/components/auction/use-bid-history";
import { useAuctionView } from "@/components/use-auction-view";
import {
  deriveAuctionUiStatus,
  playerDisplayName,
  playerRolesLabel,
} from "@/lib/auction-ui";
import { STARTING_PURSE } from "@/lib/constants";
import type { WebAuctionView } from "@/lib/web-auction";

export function AdminAuctionDesk({
  view,
  format,
  medals,
}: {
  view: WebAuctionView;
  format: string;
  medals: readonly string[];
}) {
  const { view: live, accept, connected, problem, secondsLeft, closed } =
    useAuctionView(view);
  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  }, [accept]);

  const onResult = useCallback((result: unknown) => {
    if (result && typeof result === "object" && "revision" in result) {
      acceptRef.current?.(result as WebAuctionView);
    }
  }, []);

  const bids = useBidHistory(live);
  const status = deriveAuctionUiStatus(live, closed);

  const stats = useMemo(() => {
    const soldFromTeams = live.teamBalances.reduce(
      (sum, t) =>
        sum + t.players.filter((p) => !p.captain && p.price != null).length,
      0,
    );
    const spent = live.teamBalances.reduce(
      (sum, t) => sum + Math.max(0, STARTING_PURSE - t.purse),
      0,
    );
    const remaining = live.remainingInPool + (live.currentPlayer ? 1 : 0);
    return {
      totalPlayers: soldFromTeams + remaining,
      soldPlayers: soldFromTeams,
      unsoldPlayers: live.event === "unsold" ? 1 : 0,
      remainingPlayers: remaining,
      totalSpending: spent,
    };
  }, [live]);

  if (format === "TEAM_BASED") {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        This season is <strong>team-based</strong>. Assign players under Teams —
        no live auction desk.
      </p>
    );
  }

  const upcomingQueue = live.upcoming.map((p) => ({
    id: p.id,
    name: p.name,
    medal: p.medal,
    basePrice: p.basePrice,
    status: "upcoming" as const,
  }));

  const currentQueue = live.currentPlayer
    ? {
        id: live.currentPlayer.id,
        name: playerDisplayName(live.currentPlayer, live.game),
        medal: live.currentPlayer.medal,
        basePrice: live.currentPlayer.basePrice,
        rolesLabel: playerRolesLabel(live.currentPlayer.rolesJson),
        status,
      }
    : null;

  return (
    <div className="grid gap-6">
      <p
        role="status"
        className={
          connected
            ? "m-0 text-sm text-emerald-300"
            : "m-0 text-sm text-amber-300"
        }
      >
        {connected
          ? "Live updates connected — controls enabled."
          : problem
            ? `Reconnecting — ${problem}`
            : "Reconnecting — auction controls stay locked until updates resume."}
      </p>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <CurrentPlayerCard
          player={live.currentPlayer}
          game={live.game}
          medalLabel={live.medalLabel}
          status={status}
          currentBid={live.currentBid}
          highBidderName={live.highBidder?.name}
          highBidderId={live.highBidder?.id}
          secondsLeft={secondsLeft}
          timerRunning={live.status === "running" && !!live.endsAt}
          timerPaused={live.status === "paused"}
        />
        <AuctionControls
          view={live}
          medals={medals}
          connected={connected}
          onResult={onResult}
        />
      </div>

      <AuctionStatistics {...stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AuctionPlayerQueue current={currentQueue} upcoming={upcomingQueue} />
        <BidHistory bids={bids} />
      </div>
      <TeamBudgetOverview
        teams={live.teamBalances}
        leadingTeamId={live.highBidder?.id}
      />
    </div>
  );
}
