"use client";

import { useMemo, useState } from "react";
import { formatMatchTimesAllZones } from "@/lib/match-times";
import { cn } from "@/lib/utils";

export function MatchTimeZones({
  at,
  className,
}: {
  at: Date | string;
  className?: string;
}) {
  const zones = useMemo(
    () => formatMatchTimesAllZones(typeof at === "string" ? new Date(at) : at),
    [at],
  );
  const [zone, setZone] = useState(zones[0]?.label ?? "Pakistan");
  const active = zones.find((row) => row.label === zone) ?? zones[0];

  if (!active) return null;

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        className="min-w-0 overflow-x-auto overflow-y-hidden scrollbar-thin"
        role="tablist"
        aria-label="Kickoff time zones"
      >
        <div className="inline-flex w-max min-w-full gap-2 p-0.5">
          {zones.map((row) => {
            const selected = row.label === zone;
            return (
              <button
                key={row.label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setZone(row.label)}
                className={cn(
                  "h-auto shrink-0 rounded-lg border bg-[#0a0d14]/80 px-3 py-2 text-left transition-all duration-200",
                  selected
                    ? "border-amber-500 bg-amber-500/10 text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                <span className="grid min-w-[7.5rem] gap-1">
                  <span className="text-[0.62rem] font-semibold tracking-[0.14em] uppercase">
                    {row.label}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[0.72rem] font-medium tracking-wide tabular-nums",
                      selected ? "text-zinc-100" : "text-zinc-300",
                    )}
                  >
                    {row.when}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0a0d14]/80 px-3.5 py-3">
        <p className="m-0 text-[0.62rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Local kickoff · {active.label}
        </p>
        <p className="mt-1.5 mb-0 font-mono text-xl font-bold tracking-wider text-white tabular-nums">
          {active.when}
        </p>
      </div>
    </div>
  );
}
