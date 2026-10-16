"use client";

import { EsportsCard } from "@/components/common";
import { AuctionStatusBadge } from "@/components/auction/auction-status-badge";
import { AuctionTimer } from "@/components/auction/auction-timer";
import { CurrentBidDisplay } from "@/components/auction/current-bid-display";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import { PlayerRankBadge } from "@/components/auction/player-rank-badge";
import {
  formatAuctionPoints,
  playerDisplayName,
  primarySecondaryRoles,
  type AuctionUiStatus,
} from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

type CurrentAuctionPlayer = {
  id: string;
  steamName: string;
  pubgName?: string | null;
  medal: string;
  rolesJson: string;
  basePrice: number;
};

export function CurrentPlayerCard({
  player,
  game,
  medalLabel,
  status,
  currentBid,
  highBidderName,
  highBidderId,
  secondsLeft,
  timerRunning,
  timerPaused,
  soldFlash,
  className,
  children,
}: {
  player: CurrentAuctionPlayer | null;
  game: string | null;
  medalLabel?: string | null;
  status: AuctionUiStatus;
  currentBid: number;
  highBidderName?: string | null;
  highBidderId?: string | null;
  secondsLeft: number;
  timerRunning?: boolean;
  timerPaused?: boolean;
  soldFlash?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const name = playerDisplayName(player, game);
  const { primary, secondary } = primarySecondaryRoles(player?.rolesJson);

  return (
    <EsportsCard
      interactive={false}
      className={cn(
        "relative overflow-hidden p-5 sm:p-6",
        soldFlash && "ring-2 ring-primary/60",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_55%)]" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
          On the block
        </p>
        <AuctionStatusBadge status={status} />
      </div>

      {player ? (
        <div className="relative mt-5 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="flex flex-col items-center gap-3">
            <PlayerAvatar
              name={name}
              size="xl"
              highlight={status === "live"}
            />
            <PlayerRankBadge medal={player.medal} medalLabel={medalLabel} />
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <h2
                key={player.id}
                className="m-0 font-display text-3xl tracking-wide uppercase sm:text-4xl animate-in fade-in duration-500"
              >
                {name}
              </h2>
              <p className="mt-2 mb-0 text-sm text-muted-foreground">
                Rank medal · {medalLabel ?? player.medal}
                {game === "PUBG" ? " (PUBG)" : " · Dota 2"}
              </p>
            </div>

            <dl className="m-0 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Meta label="Primary" value={primary ?? "—"} />
              <Meta label="Secondary" value={secondary ?? "—"} />
              <Meta
                label="Base price"
                value={`${formatAuctionPoints(player.basePrice)} pts`}
                mono
              />
              <Meta label="Rank" value={medalLabel ?? player.medal} />
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
              <CurrentBidDisplay
                amount={currentBid}
                teamName={highBidderName}
                teamId={highBidderId}
              />
              <div className="flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-4">
                <AuctionTimer
                  secondsLeft={secondsLeft}
                  running={timerRunning}
                  paused={timerPaused}
                />
              </div>
            </div>

            {children}
          </div>
        </div>
      ) : (
        <div className="relative mt-8 rounded-xl border border-dashed border-white/15 px-4 py-12 text-center">
          <p className="m-0 font-display text-xl tracking-wide uppercase text-muted-foreground">
            Waiting for next lot
          </p>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            The auction desk will introduce the next player when the pool opens.
          </p>
          {children}
        </div>
      )}
    </EsportsCard>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <dt className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 mb-0 truncate font-medium",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
