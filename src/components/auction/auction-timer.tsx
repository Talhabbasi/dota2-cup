"use client";

import { BID_CLOCK_SECONDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AuctionTimer({
  secondsLeft,
  running,
  paused,
  className,
  size = "lg",
}: {
  secondsLeft: number;
  running?: boolean;
  paused?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const urgent = running && !paused && secondsLeft > 0 && secondsLeft <= 5;
  const mm = Math.floor(Math.max(0, secondsLeft) / 60);
  const ss = Math.max(0, secondsLeft) % 60;
  const label = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const progress = Math.min(
    100,
    Math.max(0, (secondsLeft / BID_CLOCK_SECONDS) * 100),
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        size === "lg" && "items-center",
        className,
      )}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={
        paused
          ? `Auction paused, ${secondsLeft} seconds remaining`
          : `Hammer in ${label}`
      }
    >
      <p className="m-0 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {paused ? "Paused" : running ? "Hammer in" : "Clock"}
      </p>
      <p
        className={cn(
          "m-0 font-mono font-bold tabular-nums tracking-tight transition-colors duration-300",
          size === "lg" && "text-4xl sm:text-5xl",
          size === "md" && "text-2xl",
          size === "sm" && "text-lg",
          urgent && "animate-pulse text-dire",
          paused && "text-amber-300",
          !urgent && !paused && "text-foreground",
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "h-1 overflow-hidden rounded-full bg-white/10",
          size === "lg" ? "w-full max-w-[12rem]" : "w-full",
        )}
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width,background-color] duration-300",
            urgent ? "bg-dire" : paused ? "bg-amber-400/80" : "bg-primary",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
