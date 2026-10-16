"use client";

import { formatAuctionPoints } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export function AuctionSoldStamp({
  show,
  teamName,
  price,
  unsold,
  className,
}: {
  show: boolean;
  teamName?: string | null;
  price?: number | null;
  unsold?: boolean;
  className?: string;
}) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center",
        className,
      )}
      aria-live="assertive"
    >
      <div className="absolute inset-0 bg-[#0a0d14]/55 backdrop-blur-[2px] animate-in fade-in duration-300" />
      <div
        className={cn(
          "auction-sold-stamp relative rotate-[-12deg] border-[5px] px-8 py-3 font-display text-5xl font-black tracking-[0.12em] uppercase sm:text-6xl md:text-7xl",
          unsold
            ? "border-red-400/90 text-red-400"
            : "border-dire text-dire",
          "shadow-[0_0_40px_rgba(239,68,68,0.35)]",
        )}
      >
        {unsold ? "Unsold" : "Sold"}
      </div>
      {!unsold && teamName ? (
        <p className="relative mt-5 m-0 max-w-[90%] text-center font-display text-sm tracking-[0.16em] text-foreground uppercase sm:text-base animate-in fade-in slide-in-from-bottom-2 duration-500">
          {teamName}
          {price != null ? ` · ${formatAuctionPoints(price)} pts` : ""}
        </p>
      ) : null}
    </div>
  );
}
