"use client";

import { useEffect, useRef, useState } from "react";
import type { WebAuctionView } from "@/lib/web-auction";
import { BID_INCREMENT } from "@/lib/constants";
import { useAuctionView } from "./use-auction-view";
import { cn } from "@/lib/utils";

export function LiveAuctionBoard({
  initial,
  canBid = false,
  teamId = null,
  onView,
}: {
  initial: WebAuctionView;
  canBid?: boolean;
  teamId?: string | null;
  onView?: (view: WebAuctionView, connected: boolean) => void;
}) {
  const { view, accept, connected, secondsLeft, closed } = useAuctionView(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState<{ lotId: string; amount: number; requestId: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => { onView?.(view, connected); }, [view, connected, onView]);

  async function bid() {
    if (submitting.current || !connected || (!uncertain && (closed || !view.lotId))) return;
    const payload = uncertain ?? { lotId: view.lotId!, amount: view.highBidder ? view.currentBid + BID_INCREMENT : view.currentBid, requestId: crypto.randomUUID() };
    submitting.current = true;
    setPending(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/auction/bid", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (res.status >= 500) setUncertain(payload);
        else setUncertain(null);
        setError(json.error ?? "Bid failed. Refresh the auction.");
        return;
      }
      setUncertain(null);
      if (json.view) accept(json.view);
    } catch {
      setUncertain(payload);
      setError("Connection interrupted. Check the result using the same bid request.");
    } finally {
      clearTimeout(timeout);
      submitting.current = false;
      setPending(false);
    }
  }

  const idle = view.status === "idle";
  const youAreHigh =
    canBid && teamId && view.highBidder?.id === teamId;

  return (
    <div className="grid gap-4">
      <p role="status" className={connected ? "m-0 text-sm text-emerald-300" : "m-0 text-sm text-amber-300"}>
        {connected ? "Live updates connected" : "Reconnecting — bidding is disabled until updates resume."}
      </p>
      <div className="rounded-xl border border-white/10 bg-[#121824]/90 p-5">
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
          {idle
            ? "Auction idle"
            : view.status === "paused"
              ? "Paused"
              : closed
                ? "Awaiting sold / pass"
                : "Live lot"}
        </p>
        {view.currentPlayer ? (
          <>
            <h2 className="mt-2 mb-1 font-display text-3xl tracking-wide uppercase">
              {view.game === "PUBG"
                ? view.currentPlayer.pubgName || view.currentPlayer.steamName
                : view.currentPlayer.steamName}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {view.medalLabel ?? view.currentPlayer.medal}
              {view.game === "PUBG" ? " medal" : ""} · floor{" "}
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
          <Stat label="Clock" value={view.endsAt || view.status === "paused" ? `${secondsLeft}s` : "Not started"} />
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
              disabled={pending || !connected || (!uncertain && (idle || view.status !== "running" || closed || Boolean(youAreHigh)))}
              onClick={bid}
              className={cn(
                "rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40",
              )}
            >
              {uncertain
                ? "Check previous bid"
                : youAreHigh
                ? "You are high bidder"
                : pending
                  ? "Bidding…"
                  : `Bid ${view.highBidder ? view.currentBid + BID_INCREMENT : view.currentBid}`}
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
