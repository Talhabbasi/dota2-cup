import { EsportsCard } from "@/components/common";
import { AuctionStatusBadge } from "@/components/auction/auction-status-badge";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import { PlayerRankBadge } from "@/components/auction/player-rank-badge";
import {
  formatAuctionPoints,
  type AuctionUiStatus,
} from "@/lib/auction-ui";
import { labelForMedal } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type QueuePlayer = {
  id: string;
  name: string;
  medal: string;
  basePrice: number;
  rolesLabel?: string;
  status: AuctionUiStatus | "upcoming" | "completed";
};

export function AuctionPlayerQueue({
  current,
  upcoming,
  completed,
  className,
  listClassName,
}: {
  current?: QueuePlayer | null;
  upcoming: QueuePlayer[];
  completed?: QueuePlayer[];
  className?: string;
  listClassName?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {current ? (
        <EsportsCard
          interactive={false}
          className="border-primary/35 bg-primary/5 p-4"
        >
          <p className="m-0 text-[0.65rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Currently auctioned
          </p>
          <QueueRow player={current} active />
        </EsportsCard>
      ) : null}

      <EsportsCard interactive={false} className="overflow-hidden p-0">
        <header className="border-b border-white/10 px-4 py-3">
          <h3 className="m-0 font-display text-sm tracking-[0.14em] uppercase">
            Upcoming ({upcoming.length})
          </h3>
        </header>
        {upcoming.length === 0 ? (
          <p className="m-0 px-4 py-6 text-sm text-muted-foreground">
            No players waiting in the pool.
          </p>
        ) : (
          <ol
            className={cn(
              "m-0 list-none divide-y divide-white/5 overflow-y-auto overscroll-contain p-0",
              listClassName,
            )}
          >
            {upcoming.map((player, index) => (
              <li key={player.id} className="px-4 py-3">
                <QueueRow player={player} position={index + 1} />
              </li>
            ))}
          </ol>
        )}
      </EsportsCard>

      {completed && completed.length > 0 ? (
        <EsportsCard interactive={false} className="overflow-hidden p-0">
          <header className="border-b border-white/10 px-4 py-3">
            <h3 className="m-0 font-display text-sm tracking-[0.14em] uppercase">
              Completed ({completed.length})
            </h3>
          </header>
          <ol className="m-0 list-none divide-y divide-white/5 p-0">
            {completed.map((player) => (
              <li key={player.id} className="px-4 py-3 opacity-80">
                <QueueRow player={player} />
              </li>
            ))}
          </ol>
        </EsportsCard>
      ) : null}
    </div>
  );
}

function QueueRow({
  player,
  position,
  active,
}: {
  player: QueuePlayer;
  position?: number;
  active?: boolean;
}) {
  const status: AuctionUiStatus =
    player.status === "upcoming"
      ? "waiting"
      : player.status === "completed"
        ? "sold"
        : player.status;

  return (
    <div className="flex items-center gap-3">
      {position != null ? (
        <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
          {position}.
        </span>
      ) : null}
      <PlayerAvatar name={player.name} size="sm" highlight={active} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-medium">{player.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <PlayerRankBadge medal={player.medal} medalLabel={labelForMedal(player.medal)} />
          {player.rolesLabel ? (
            <span className="team-role-pill">{player.rolesLabel}</span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="m-0 font-mono text-sm tabular-nums">
          {formatAuctionPoints(player.basePrice)}
        </p>
        <div className="mt-1 flex justify-end">
          <AuctionStatusBadge status={status} className="text-[0.58rem]" />
        </div>
      </div>
    </div>
  );
}
