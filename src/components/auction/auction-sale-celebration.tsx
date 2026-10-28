"use client";

import { Hammer } from "lucide-react";
import { useEffect, useState } from "react";
import { formatAuctionPoints } from "@/lib/auction-ui";
import type { WebSale } from "@/lib/web-auction";

const POPPERS = ["#f5b942", "#f97316", "#34d399", "#60a5fa", "#f472b6", "#facc15"];

function saleKey(sale: WebSale | null) {
  if (!sale) return null;
  return `${sale.playerName}|${sale.teamName ?? ""}|${sale.price ?? ""}`;
}

export function AuctionSaleCelebration({ sale }: { sale: WebSale | null }) {
  const key = saleKey(sale);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [burst, setBurst] = useState<WebSale | null>(null);

  if (key !== seenKey) {
    setSeenKey(key);
    if (seenKey !== null && sale) setBurst(sale);
  }

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 4200);
    return () => window.clearTimeout(timer);
  }, [burst]);

  if (!burst) return null;

  const sold = Boolean(burst.teamName);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      role="status"
      aria-live="assertive"
    >
      <div className="absolute inset-0 bg-black/45" />
      {sold
        ? POPPERS.map((color, index) => (
            <span
              key={color}
              className="auction-popper absolute top-1/3 h-2.5 w-2.5 rounded-sm"
              style={{
                background: color,
                left: `${18 + index * 11}%`,
                animationDelay: `${index * 70}ms`,
              }}
            />
          ))
        : null}
      <div className="relative mx-4 max-w-lg rounded-2xl border border-white/15 bg-[#12151c]/95 px-8 py-7 text-center shadow-2xl">
        {sold ? (
          <Hammer className="mx-auto mb-3 size-12 text-primary" aria-hidden />
        ) : null}
        <p className="m-0 font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
          {sold ? "Sold" : "Unpicked"}
        </p>
        <p className="mt-3 mb-0 text-sm text-muted-foreground sm:text-base">
          {sold ? (
            <>
              <span className="font-semibold text-foreground">{burst.playerName}</span>
              {" sold to "}
              <span className="font-semibold text-foreground">{burst.teamName}</span>
              {burst.price != null ? ` for ${formatAuctionPoints(burst.price)} pts` : ""}
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{burst.playerName}</span>
              {" unpicked"}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
