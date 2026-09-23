import Link from "next/link";
import {
  EsportsCard,
  TeamBadge,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import {
  formatPoints,
  MIN_ROSTER,
  STARTING_PURSE,
} from "@/lib/constants";
import type { AuctionSaleRow, SeasonAuctionBlock } from "@/lib/auction-results";
import { cn } from "@/lib/utils";

export type AuctionCaptainCard = {
  id: string;
  name: string;
  captainName: string | null;
  purse: number;
  starterCount: number;
  spent: number;
};

function statusLabel(status: string, live: boolean) {
  if (live) return "Live";
  if (status === "archived") return "Closed";
  if (status === "upcoming") return "Upcoming";
  return status;
}

function seasonTitle(number: number, name: string) {
  if (number <= 0) return name;
  if (name !== `Season ${number}`) return `Season ${number} · ${name}`;
  return `Season ${number}`;
}

function PurseBar({ remaining, purse }: { remaining: number; purse: number }) {
  const total = purse > 0 ? purse : STARTING_PURSE;
  const spent = Math.max(0, total - remaining);
  const remainingPct = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">
        <span>Purse left</span>
        <span className="font-mono tabular-nums text-foreground">
          {formatPoints(remaining)} / {formatPoints(total)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-amber-500/75 transition-[width]"
          style={{ width: `${remainingPct}%` }}
          title={`${formatPoints(spent)} spent`}
        />
      </div>
    </div>
  );
}

function HighBidCard({ sale }: { sale: AuctionSaleRow }) {
  return (
    <EsportsCard className="overflow-hidden p-0" interactive={false}>
      <div className="border-b border-white/10 bg-amber-500/5 px-5 py-3">
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-amber-400 uppercase">
          Highest bid · Live season
        </p>
      </div>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Lot
          </p>
          <Link
            href={`/players/${sale.playerId}`}
            className="mt-1 block truncate font-display text-xl font-bold text-foreground!"
          >
            {sale.playerName}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="team-medal-pill">{sale.medalLabel}</span>
            {sale.rolesLabel ? (
              <span className="team-role-pill">{sale.rolesLabel}</span>
            ) : null}
            {sale.reserve ? (
              <Badge variant="outline" className="border-white/15 text-muted-foreground">
                Unsold · 2,000
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <p className="m-0 font-mono text-2xl font-bold tabular-nums text-amber-400">
            💰 {formatPoints(sale.soldPrice)} PTS
          </p>
          <Link href={`/teams/${sale.teamId}`} className="text-foreground!">
            <TeamBadge name={sale.teamName} size="md" />
          </Link>
        </div>
      </div>
    </EsportsCard>
  );
}

function CaptainCard({ team }: { team: AuctionCaptainCard }) {
  return (
    <EsportsCard className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/teams/${team.id}`} className="min-w-0 text-foreground!">
          <TeamBadge name={team.name} size="md" />
        </Link>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 border-white/15 font-mono tabular-nums",
            team.starterCount >= MIN_ROSTER
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
              : "text-muted-foreground",
          )}
        >
          {team.starterCount}/{MIN_ROSTER} Drafted
        </Badge>
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        {team.captainName ? (
          <>
            Captain <strong className="text-foreground">{team.captainName}</strong>
          </>
        ) : (
          "No captain"
        )}
      </p>
      <PurseBar remaining={team.purse} purse={STARTING_PURSE} />
      <p className="m-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatPoints(team.spent)} pts spent
      </p>
    </EsportsCard>
  );
}

function SeasonSalesList({ season }: { season: SeasonAuctionBlock }) {
  return (
    <EsportsCard interactive={false} className="overflow-hidden p-0">
      <header className="border-b border-white/10 px-5 py-4">
        <p className="eyebrow m-0 flex flex-wrap items-center gap-2">
          {statusLabel(season.status, season.live)}
          {season.live ? (
            <Badge className="bg-amber-500 text-black hover:bg-amber-500">Now</Badge>
          ) : null}
        </p>
        <h2 className="mt-1 mb-0 font-display text-xl">
          {seasonTitle(season.number, season.name)}
        </h2>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">
          {season.soldCount} sold
          {season.soldCount > 0 ? ` · ${season.spentLabel} pts spent` : ""}
        </p>
      </header>

      {season.sales.length === 0 ? (
        <p className="m-0 px-5 py-4 text-sm text-muted-foreground">
          No rostered auction players for this season yet.
        </p>
      ) : (
        <ol className="m-0 list-none divide-y divide-white/10 p-0">
          {season.sales.map((sale, index) => (
            <li
              key={sale.lotId}
              className={cn(
                "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-5 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center",
                sale.highest && "bg-amber-500/5",
              )}
            >
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <Link
                  href={`/players/${sale.playerId}`}
                  className="font-medium text-foreground!"
                >
                  {sale.playerName}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="team-medal-pill">{sale.medalLabel}</span>
                  {sale.rolesLabel ? (
                    <span className="team-role-pill">{sale.rolesLabel}</span>
                  ) : null}
                  {sale.highest ? (
                    <Badge className="bg-amber-500 text-[0.58rem] text-black hover:bg-amber-500">
                      Top bid
                    </Badge>
                  ) : null}
                  {sale.reserve ? (
                    <span className="team-role-pill">Unsold · 2,000</span>
                  ) : null}
                </div>
              </div>
              <p className="col-start-2 m-0 text-sm text-muted-foreground sm:col-auto">
                <span className="mr-1">sold to</span>
                <Link href={`/teams/${sale.teamId}`} className="text-foreground!">
                  {sale.teamName}
                </Link>
              </p>
              <p className="col-start-2 m-0 font-mono text-sm font-bold tabular-nums text-amber-400 sm:col-auto sm:text-right">
                {sale.soldPriceLabel}
                <small className="ml-1 font-sans font-normal text-muted-foreground">
                  pts
                </small>
              </p>
            </li>
          ))}
        </ol>
      )}
    </EsportsCard>
  );
}

export function AuctionBoard({
  seasons,
  captains,
  highBid,
}: {
  seasons: SeasonAuctionBlock[];
  captains: AuctionCaptainCard[];
  highBid: AuctionSaleRow | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      {highBid ? <HighBidCard sale={highBid} /> : null}

      {captains.length > 0 ? (
        <section>
          <div className="section-head mb-3">
            <h2>Franchise purses</h2>
            <span className="muted">Remaining budget & draft fill</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {captains.map((team) => (
              <CaptainCard key={team.id} team={team} />
            ))}
          </div>
        </section>
      ) : null}

      {seasons.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🔨
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No lots have been confirmed yet. After an admin confirms a bid in
            Discord, the player, team, and price will show here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {seasons.map((season) => (
            <SeasonSalesList key={season.seasonId} season={season} />
          ))}
        </div>
      )}
    </div>
  );
}
