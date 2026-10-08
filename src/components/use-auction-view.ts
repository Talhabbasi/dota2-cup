"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebAuctionView } from "@/lib/web-auction";

export function useAuctionView(initial: WebAuctionView) {
  const [view, setView] = useState(initial);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(false);
  const latest = useRef(initial);
  const accept = useCallback((next: WebAuctionView) => {
    if (next.revision < latest.current.revision || (next.revision === latest.current.revision && next.serverTime < latest.current.serverTime)) return;
    latest.current = next;
    setView(next);
    setReceivedAt(Date.now());
    setNow(Date.now());
    setOnline(true);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    let failures = 0;
    let inFlight = false;
    async function poll() {
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const res = await fetch("/api/auction/status", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("Updates unavailable");
        const data: WebAuctionView = await res.json();
        if (stopped) return;
        accept(data);
        failures = 0;
      } catch {
        if (!stopped) { setOnline(false); failures++; }
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (!stopped) {
          const idle = latest.current.status === "idle";
          timer = setTimeout(poll, failures ? Math.min(1000 * 2 ** failures, 15000) : document.hidden || idle ? 10000 : 1500);
        }
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now()), 250);
    const offline = () => setOnline(false);
    const visible = () => { if (!document.hidden && !inFlight) { clearTimeout(timer); void poll(); } };
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; clearTimeout(timer); clearInterval(clock); controller?.abort(); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visible); };
  }, [accept]);

  // Idle and hidden-tab polls run every 10s, so allow a longer gap before calling it stale.
  const staleAfter = view.status === "idle" ? 15000 : 6000;
  const connected = online && receivedAt > 0 && now - receivedAt < staleAfter;
  const serverNow = view.serverTime + Math.max(0, now - receivedAt);
  const secondsLeft = view.status === "paused" ? view.secondsLeft : view.endsAt ? Math.max(0, Math.ceil((new Date(view.endsAt).getTime() - serverNow) / 1000)) : 0;
  const closed = view.awaitingDecision || (view.status === "running" && !!view.endsAt && secondsLeft === 0);
  return { view, accept, connected, secondsLeft, closed };
}
