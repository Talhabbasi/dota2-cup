import Link from "next/link";
import { EsportsCard, TeamBadge } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import { PlayerRankBadge } from "@/components/auction/player-rank-badge";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export type SoldPlayerCardData = {
  playerId: string;
  playerName: string;
  medalLabel: string;
  rolesLabel: string;
  teamId: string | null;
  teamName: string | null;
  soldPrice: number | null;
  sold: boolean;
};

export function SoldPlayerCard({
  player,
  className,
}: {
  player: SoldPlayerCardData;
  className?: string;
}) {
  return (
    <EsportsCard className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start gap-3">
        <PlayerAvatar name={player.playerName} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/players/${player.playerId}`}
            className="block truncate font-display text-lg tracking-wide uppercase text-foreground!"
          >
            {player.playerName}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <PlayerRankBadge medal={player.medalLabel} medalLabel={player.medalLabel} />
            {player.rolesLabel ? (
              <span className="team-role-pill">{player.rolesLabel}</span>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                "border-white/15",
                player.sold
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  : "text-muted-foreground",
              )}
            >
              {player.sold ? "Sold" : "Unsold"}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        {player.teamName && player.teamId ? (
          <Link href={`/teams/${player.teamId}`} className="text-foreground!">
            <TeamBadge name={player.teamName} size="sm" />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">No team</span>
        )}
        <p className="m-0 font-mono text-base font-bold tabular-nums text-primary">
          {player.soldPrice != null
            ? `${formatAuctionPoints(player.soldPrice)} pts`
            : "—"}
        </p>
      </div>
    </EsportsCard>
  );
}
