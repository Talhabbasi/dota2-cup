"use client";

import { Button } from "@/components/ui/button";
import { AuctionSoldStamp } from "@/components/auction/auction-sold-stamp";
import { AuctionTimer } from "@/components/auction/auction-timer";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import { PlayerRankBadge } from "@/components/auction/player-rank-badge";
import { displayTeamName } from "@/components/auction/team-purse-strip";
import {
  formatAuctionPoints,
  minNextBid,
  playerDisplayName,
  primarySecondaryRoles,
  type AuctionUiStatus,
} from "@/lib/auction-ui";
import { BID_INCREMENT, labelForMedal } from "@/lib/constants";
import { CUP_NAME } from "@/lib/brand";
import type { WebAuctionView } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

type CurrentAuctionPlayer = {
  id: string;
  steamName: string;
  discordName?: string | null;
  pubgName?: string | null;
  medal: string;
  rolesJson: string;
  basePrice: number;
  imageUrl?: string | null;
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/6 py-2 last:border-0">
      <span className="text-[0.68rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-semibold break-words text-foreground">
        {value}
      </span>
    </div>
  );
}

export function AuctionLotStage({
  view,
  player,
  status,
  secondsLeft,
  timerRunning,
  timerPaused,
  canBid,
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
  player: CurrentAuctionPlayer | null;
  status: AuctionUiStatus;
  secondsLeft: number;
  timerRunning?: boolean;
  timerPaused?: boolean;
  canBid?: boolean;
  teamId?: string | null;
  teamPurse?: number;
  connected?: boolean;
  closed?: boolean;
  pending?: boolean;
  error?: string | null;
  uncertain?: { lotId: string; amount: number; requestId: string } | null;
  onBid?: (amount: number) => void;
  onRetryUncertain?: () => void;
  className?: string;
}) {
  const name = playerDisplayName(player, view.game);
  const { primary, secondary } = primarySecondaryRoles(player?.rolesJson);
  // Player medal only — never the pool label ("All ranks · random").
  const playerRank = player?.medal ? labelForMedal(player.medal) : "—";
  const poolLabel =
    view.medalLabel ??
    (view.medal ? labelForMedal(view.medal) : null);
  const youAreHigh = Boolean(canBid && teamId && view.highBidder?.id === teamId);
  const nextMin = minNextBid(view);
  const bidSteps = [BID_INCREMENT, 500, 5000] as const;
  const timerUp =
    Boolean(closed) ||
    (view.status === "running" &&
      Boolean(view.endsAt) &&
      secondsLeft <= 0);
  const showSold = status === "sold" || view.event === "sold";
  const showUnsold = status === "unsold" || view.event === "unsold";
  const showStamp = showSold || showUnsold;
  const insufficient =
    teamPurse != null && teamPurse < nextMin && !youAreHigh;
  const lotLabel = player
    ? status === "live"
      ? "Live"
      : status === "paused"
        ? "Paused"
        : status === "sold"
          ? "Sold"
          : status === "unsold"
            ? "Unsold"
            : "Waiting"
    : "Waiting";

  const biddingLocked =
    !canBid ||
    !connected ||
    !view.lotId ||
    view.status !== "running" ||
    timerPaused ||
    timerUp ||
    closed ||
    pending ||
    youAreHigh;

  function amountForStep(step: number) {
    const opening = !view.highBidder && step === BID_INCREMENT;
    // Lots open at 0 — first placeable bid is nextMin (BID_INCREMENT).
    return opening ? nextMin : view.currentBid + step;
  }

  function requestRaise(amount: number) {
    if (!onBid || biddingLocked) return;
    if (teamPurse != null && amount > teamPurse) return;
    onBid(amount);
  }

  let bidHint: string | null = null;
  if (!canBid) bidHint = null;
  else if (!connected) bidHint = "Reconnecting — bidding paused";
  else if (view.status === "paused" || timerPaused) bidHint = "Auction paused";
  else if (timerUp || closed) bidHint = "Bidding is closed";
  else if (youAreHigh) bidHint = "You hold the highest bid";
  else if (insufficient) bidHint = "Insufficient team budget";
  else if (teamPurse != null) {
    bidHint = `Your purse ${formatAuctionPoints(teamPurse)} pts · min next ${formatAuctionPoints(nextMin)}`;
  }

  const shell = cn(
    "relative min-w-0 overflow-hidden rounded-xl border border-white/12 bg-[#121824]",
    "shadow-[0_14px_40px_rgba(0,0,0,0.4),4px_4px_0_rgba(245,158,11,0.14)]",
    className,
  );

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-2 text-primary-foreground">
      <p className="m-0 font-display text-sm font-bold tracking-[0.1em] uppercase">
        {player ? `Lot · ${lotLabel}` : "Lot · Waiting"}
      </p>
      <p className="m-0 text-xs font-semibold tracking-wide opacity-90">
        {CUP_NAME}
      </p>
    </header>
  );

  if (!player) {
    return (
      <section className={cn(shell, "xl:col-span-2")}>
        {header}
        <div className="px-4 py-14 text-center sm:px-5">
          <p className="m-0 font-display text-xl text-muted-foreground sm:text-2xl">
            Waiting for next lot
          </p>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            The auction desk will introduce the next player when the pool opens.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* LEFT — player profile */}
      <aside className={cn(shell, "flex h-full flex-col")}>
        {header}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div key={player.id} className="auction-player-enter mx-auto">
            <PlayerAvatar
              name={name}
              imageUrl={player.imageUrl}
              size="lg"
              square
              className="size-28! sm:size-32!"
              highlight={status === "live" && !showStamp}
            />
          </div>

          <p className="mt-4 mb-0 text-center text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
            {view.game === "PUBG" ? "In-game name" : "Dota name"}
          </p>
          <h2
            key={`name-${player.id}`}
            className="mt-1 mb-0 text-center font-display text-xl font-bold leading-snug break-words text-foreground sm:text-2xl"
          >
            {name}
          </h2>

          <div className="mt-3 space-y-0">
            <StatRow label="Discord" value={player.discordName?.trim() || "—"} />
            <StatRow label="Steam" value={player.steamName?.trim() || "—"} />
            <div className="flex items-center justify-between gap-3 border-b border-white/6 py-2">
              <span className="text-[0.68rem] tracking-wide text-muted-foreground uppercase">
                Rank
              </span>
              {player?.medal ? (
                <PlayerRankBadge medal={player.medal} medalLabel={playerRank} />
              ) : (
                <span className="text-sm font-semibold text-foreground">—</span>
              )}
            </div>
            {primary ? <StatRow label="Primary role" value={primary} /> : null}
            {secondary ? (
              <StatRow label="Secondary role" value={secondary} />
            ) : null}
            <StatRow
              label="Base price"
              value={`${formatAuctionPoints(player.basePrice)} pts`}
            />
            {poolLabel ? <StatRow label="Auction pool" value={poolLabel} /> : null}
          </div>
        </div>
      </aside>

      {/* CENTER — live bidding */}
      <section className={cn(shell, "flex h-full min-h-0 flex-col overflow-y-auto")}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/25 px-4 py-2.5">
          <p className="m-0 font-display text-sm tracking-[0.1em] text-primary uppercase">
            Live bidding
          </p>
          <p className="m-0 text-[0.68rem] text-muted-foreground">
            {view.status === "paused"
              ? "Paused"
              : timerUp || closed
                ? "Clock ended"
                : view.highBidder
                  ? "Active"
                  : "Opening"}
          </p>
        </header>

        <div className="relative flex flex-1 flex-col gap-4 p-4 sm:p-5">
          <AuctionSoldStamp
            show={showStamp}
            unsold={showUnsold}
            teamName={
              view.lastSale?.teamName
                ? displayTeamName(view.lastSale.teamName)
                : view.highBidder?.name
                  ? displayTeamName(view.highBidder.name)
                  : null
            }
            price={view.lastSale?.price ?? view.currentBid}
          />

          <div
            className={cn(
              "rounded-xl border px-4 py-4 sm:px-5",
              youAreHigh
                ? "border-amber-500/35 bg-amber-500/8"
                : view.highBidder
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-white/10 bg-black/20",
            )}
          >
            <p className="m-0 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Current bid
            </p>
            <p
              key={view.currentBid}
              className="m-0 mt-1 font-mono text-4xl font-black tabular-nums tracking-tight text-foreground sm:text-5xl"
            >
              {formatAuctionPoints(view.currentBid)}
              <span className="ml-2 align-middle font-sans text-sm font-semibold text-muted-foreground">
                pts
              </span>
            </p>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-white/8 pt-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.68rem] tracking-wide text-muted-foreground uppercase">
                  Leading team
                </p>
                <p
                  key={view.highBidder?.id ?? "none"}
                  className={cn(
                    "mt-0.5 mb-0 text-base font-semibold leading-snug break-words",
                    view.highBidder ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {view.highBidder
                    ? displayTeamName(view.highBidder.name)
                    : "Awaiting opening bid"}
                </p>
                {view.highBidder?.captainName ? (
                  <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                    Captain {view.highBidder.captainName}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  "shrink-0 rounded-lg border border-white/10 bg-black/35 px-4 py-3 text-center",
                  timerRunning &&
                    !timerPaused &&
                    secondsLeft <= 5 &&
                    secondsLeft > 0 &&
                    "border-dire/50 auction-timer-urgent",
                )}
              >
                <AuctionTimer
                  secondsLeft={secondsLeft}
                  running={timerRunning}
                  paused={timerPaused}
                  size="md"
                />
              </div>
            </div>
          </div>

          {canBid && teamId ? (
            <div className="grid gap-2.5">
              {uncertain ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={pending || !connected}
                  onClick={() => onRetryUncertain?.()}
                  className="h-12 w-full text-base font-semibold"
                >
                  {pending ? "Checking…" : "Check previous bid"}
                </Button>
              ) : youAreHigh ? (
                <div className="flex h-12 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 text-center text-sm font-semibold text-amber-200">
                  You hold the high bid
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {bidSteps.map((step, index) => {
                      const amount = amountForStep(step);
                      const opening =
                        !view.highBidder && step === BID_INCREMENT;
                      const tooMuch =
                        teamPurse != null && amount > teamPurse;
                      const disabled = biddingLocked || tooMuch;
                      return (
                        <Button
                          key={step}
                          type="button"
                          size="lg"
                          disabled={disabled}
                          onClick={() => requestRaise(amount)}
                          variant={index === 0 ? "default" : "outline"}
                          className={cn(
                            "h-11 text-sm font-semibold sm:h-12 sm:text-base",
                            index === 0 &&
                              "bg-primary text-primary-foreground hover:bg-primary/90",
                            tooMuch && "opacity-40",
                          )}
                        >
                          {pending && index === 0
                            ? "…"
                            : opening
                              ? formatAuctionPoints(amount)
                              : `+${formatAuctionPoints(step)}`}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={
                      biddingLocked ||
                      (teamPurse != null && nextMin > teamPurse)
                    }
                    onClick={() => requestRaise(nextMin)}
                    className="h-12 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    {pending
                      ? "Placing…"
                      : `Place bid ${formatAuctionPoints(nextMin)}`}
                  </Button>
                </>
              )}

              {bidHint ? (
                <p
                  className={cn(
                    "m-0 text-center text-xs",
                    insufficient || timerUp || closed
                      ? "font-semibold text-amber-300"
                      : "text-muted-foreground",
                  )}
                >
                  {bidHint}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="m-0 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-center text-xs text-muted-foreground">
              {view.status === "paused"
                ? "Auction paused by the organizer."
                : timerUp || closed
                  ? "Bidding is closed for this lot."
                  : "Spectating — captains bid from the captain desk."}
            </p>
          )}

          {error ? (
            <p className="m-0 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
