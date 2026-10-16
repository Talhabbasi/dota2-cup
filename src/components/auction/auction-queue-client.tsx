"use client";

import { AuctionPlayerQueue } from "@/components/auction/auction-player-queue";
import { useAuctionView } from "@/components/use-auction-view";
import {
  deriveAuctionUiStatus,
  playerDisplayName,
  playerRolesLabel,
} from "@/lib/auction-ui";
import type { WebAuctionView } from "@/lib/web-auction";

export function AuctionQueueClient({
  initial,
}: {
  initial: WebAuctionView;
}) {
  const live = useAuctionView(initial);
  const view = live.view;
  const status = deriveAuctionUiStatus(view, live.closed);

  const current = view.currentPlayer
    ? {
        id: view.currentPlayer.id,
        name: playerDisplayName(view.currentPlayer, view.game),
        medal: view.currentPlayer.medal,
        basePrice: view.currentPlayer.basePrice,
        rolesLabel: playerRolesLabel(view.currentPlayer.rolesJson),
        status,
      }
    : null;

  const upcoming = view.upcoming.map((p) => ({
    id: p.id,
    name: p.name,
    medal: p.medal,
    basePrice: p.basePrice,
    rolesLabel: playerRolesLabel(p.rolesJson),
    status: "upcoming" as const,
  }));

  const completed =
    view.lastSale && (view.event === "sold" || view.event === "unsold")
      ? [
          {
            id: `sale-${view.lastSale.playerName}`,
            name: view.lastSale.playerName,
            medal: view.lastSale.medal,
            basePrice: view.lastSale.price ?? 0,
            rolesLabel: playerRolesLabel(view.lastSale.rolesJson),
            status: "completed" as const,
          },
        ]
      : undefined;

  return (
    <div className="grid gap-4">
      {!live.connected ? (
        <p className="m-0 text-sm text-amber-200">Reconnecting to live auction…</p>
      ) : null}
      <AuctionPlayerQueue
        current={current}
        upcoming={upcoming}
        completed={completed}
      />
    </div>
  );
}
