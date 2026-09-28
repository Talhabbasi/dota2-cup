"use client";

import { useEffect, useState } from "react";
import type { WebAuctionView } from "@/lib/web-auction";
import { BID_INCREMENT } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LiveAuctionBoard({
  initial,
  canBid = false,
  teamId = null,
}: {
  initial: WebAuctionView;
  canBid?: boolean;
  teamId?: string | null;
}) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/auction/stream");
    es.addEventListener("auction", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WebAuctionView;
        setView(data);
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => {
      /* browser reconnects */
    };
    return () => es.close();
  }, []);

  async function bid() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auction/bid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bump: BID_INCREMENT }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        view?: WebAuctionView;
      };
      if (!json.ok) {
        setError(json.error ?? "Bid failed");
        return;
      }
      if (json.view) setView(json.view);
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  const idle = view.status === "idle";
  const youAreHigh =
    canBid && teamId && view.highBidder?.id === teamId;

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-white/10 bg-[#121824]/90 p-5">
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
          {idle
            ? "Auction idle"
            : view.status === "paused"
              ? "Paused"
              : view.awaitingDecision
                ? "Awaiting sold / pass"
                : "Live lot"}
        </p>
        {view.currentPlayer ? (
          <>
            <h2 className="mt-2 mb-1 font-display text-3xl tracking-wide uppercase">
              {view.currentPlayer.steamName}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {view.medalLabel ?? view.currentPlayer.medal} · floor{" "}
              {view.currentPlayer.basePrice}
            </p>
          </>
        ) : (
          <p className="mt-3 mb-0 text-muted-foreground">
            No player under the hammer.
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Current bid" value={String(view.currentBid)} />
          <Stat
            label="High bidder"
            value={view.highBidder?.name ?? "—"}
          />
          <Stat label="Clock" value={`${view.secondsLeft}s`} />
          <Stat label="Left in pool" value={String(view.remainingInPool)} />
        </div>

        {view.lastSale ? (
          <p className="mt-4 mb-0 text-sm text-muted-foreground">
            Last: {view.lastSale.playerName}
            {view.lastSale.teamName
              ? ` → ${view.lastSale.teamName} (${view.lastSale.price})`
              : " · unsold"}
          </p>
        ) : null}

        {canBid ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || idle || view.status !== "running" || view.awaitingDecision || Boolean(youAreHigh)}
              onClick={bid}
              className={cn(
                "rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40",
              )}
            >
              {youAreHigh
                ? "You are high bidder"
                : pending
                  ? "Bidding…"
                  : `+${BID_INCREMENT} bid`}
            </button>
            {error ? (
              <p className="m-0 text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {view.teamBalances.length > 0 ? (
        <div className="rounded-xl border border-white/10 p-4">
          <h3 className="mt-0 mb-3 font-display text-lg tracking-wide uppercase">
            Purses
          </h3>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {view.teamBalances.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex justify-between rounded-md border border-white/5 px-3 py-2 text-sm",
                  view.highBidder?.id === t.id && "border-amber-500/40 bg-amber-500/10",
                )}
              >
                <span>
                  {t.name}{" "}
                  <span className="text-muted-foreground">
                    ({t.rosterCount}p)
                  </span>
                </span>
                <span className="font-mono">{t.purse}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="m-0 mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
