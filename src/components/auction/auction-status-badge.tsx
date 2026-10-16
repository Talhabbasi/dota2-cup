import { Badge } from "@/components/ui/badge";
import {
  auctionStatusLabel,
  type AuctionUiStatus,
} from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

const TONE: Record<AuctionUiStatus, string> = {
  waiting: "border-white/20 bg-white/5 text-muted-foreground",
  live: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  paused: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  sold: "border-primary/50 bg-primary/15 text-primary",
  unsold: "border-dire/40 bg-dire/10 text-red-300",
};

export function AuctionStatusBadge({
  status,
  className,
  pulse,
}: {
  status: AuctionUiStatus;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border font-semibold tracking-[0.14em] uppercase",
        TONE[status],
        className,
      )}
    >
      {status === "live" || pulse ? (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            status === "live" && "animate-pulse",
          )}
          aria-hidden
        />
      ) : null}
      {auctionStatusLabel(status)}
    </Badge>
  );
}
