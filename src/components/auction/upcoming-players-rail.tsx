"use client";

import { EsportsCard } from "@/components/common";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import { PlayerRankBadge } from "@/components/auction/player-rank-badge";
import {
  formatAuctionPoints,
  primarySecondaryRoles,
} from "@/lib/auction-ui";
import { labelForMedal } from "@/lib/constants";
import type { WebUpcomingPlayer } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

export function UpcomingPlayersRail({
  upcoming,
  currentName,
  className,
}: {
  upcoming: WebUpcomingPlayer[];
  currentName?: string | null;
  className?: string;
}) {
  return (
    <EsportsCard interactive={false} className={cn("overflow-hidden p-0", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <h3 className="m-0 font-display text-sm tracking-[0.14em] uppercase">
            Coming up
          </h3>
          <p className="mt-1 mb-0 text-xs text-muted-foreground">
            Players still in this auction pool, in order.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {upcoming.length} left
          {currentName ? ` · now: ${currentName}` : ""}
        </span>
      </header>

      {upcoming.length === 0 ? (
        <p className="m-0 px-5 py-8 text-sm text-muted-foreground">
          No more players queued — this pool is empty after the current lot.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ol className="m-0 flex list-none gap-3 p-4 sm:p-5">
            {upcoming.map((player, index) => {
              const next = index === 0;
              const { primary, secondary } = primarySecondaryRoles(
                player.rolesJson,
              );
              const roleLine = [primary, secondary].filter(Boolean).join(" · ");
              return (
                <li
                  key={player.id}
                  className={cn(
                    "flex w-[10.5rem] shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors",
                    next
                      ? "border-primary/45 bg-primary/10"
                      : "border-white/10 bg-black/20",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[0.65rem] tabular-nums tracking-wide uppercase",
                      next ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {next ? "Up next" : `#${index + 1}`}
                  </span>
                  <PlayerAvatar
                    name={player.name}
                    imageUrl={player.imageUrl}
                    size="md"
                    square
                  />
                  <p className="m-0 w-full text-sm font-semibold leading-snug break-words">
                    {player.name}
                  </p>
                  {roleLine ? (
                    <p
                      className="m-0 w-full text-[0.68rem] leading-snug break-words tracking-wide text-muted-foreground uppercase"
                    >
                      {roleLine}
                    </p>
                  ) : null}
                  <PlayerRankBadge
                    medal={player.medal}
                    medalLabel={labelForMedal(player.medal)}
                  />
                  <p className="m-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatAuctionPoints(player.basePrice)} pts
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </EsportsCard>
  );
}
