import { EsportsCard, StatTile } from "@/components/common";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export function AuctionStatistics({
  totalPlayers,
  soldPlayers,
  unsoldPlayers,
  remainingPlayers,
  totalSpending,
  className,
}: {
  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
  remainingPlayers: number;
  totalSpending: number;
  className?: string;
}) {
  return (
    <EsportsCard interactive={false} className={cn("p-4", className)}>
      <h3 className="mt-0 mb-3 font-display text-sm tracking-[0.14em] uppercase">
        Auction statistics
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total" value={String(totalPlayers)} />
        <StatTile label="Sold" value={String(soldPlayers)} />
        <StatTile label="Unsold" value={String(unsoldPlayers)} />
        <StatTile label="Remaining" value={String(remainingPlayers)} />
        <StatTile
          label="Spent"
          value={formatAuctionPoints(totalSpending)}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </EsportsCard>
  );
}
