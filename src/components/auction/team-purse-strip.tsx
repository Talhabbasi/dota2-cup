"use client";

import { TeamBadge } from "@/components/common";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { STARTING_PURSE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Strip demo prefixes so "Test Liquid" / "Demo Afaq" read cleanly. */
export function displayTeamName(name: string): string {
  return name.replace(/^(Test|Demo)\s+/i, "").trim() || name;
}

export function TeamPurseStrip({
  teams,
  leadingTeamId,
  startingPurse = STARTING_PURSE,
  className,
}: {
  teams: { id: string; name: string; purse: number; rosterCount: number }[];
  leadingTeamId?: string | null;
  startingPurse?: number;
  className?: string;
}) {
  if (teams.length === 0) {
    return (
      <p className={cn("m-0 text-sm text-muted-foreground", className)}>
        Team purses appear when the pool opens.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <p className="m-0 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Team purses
      </p>
      <ul
        className={cn(
          "m-0 grid list-none gap-2.5 p-0",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {teams.map((team) => {
          const label = displayTeamName(team.name);
          const pct = Math.max(
            0,
            Math.min(
              100,
              Math.round((team.purse / Math.max(1, startingPurse)) * 100),
            ),
          );
          const leading = team.id === leadingTeamId;
          return (
            <li
              key={team.id}
              title={team.name}
              className={cn(
                "rounded-xl border px-3 py-3 transition-[border-color,background-color,box-shadow] duration-300",
                leading
                  ? "border-primary/55 bg-primary/10 shadow-[0_0_18px_rgba(245,158,11,0.22)]"
                  : "border-white/10 bg-black/25",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <TeamBadge name={label} size="sm" wrapName className="min-w-0 flex-1" />
                {leading ? (
                  <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[0.58rem] font-bold tracking-wide text-primary uppercase">
                    Leading
                  </span>
                ) : null}
              </div>
              <p className="mt-2.5 mb-0 font-mono text-base font-bold tabular-nums text-foreground sm:text-lg">
                {formatAuctionPoints(team.purse)}
                <span className="ml-1 font-sans text-[0.65rem] font-normal text-muted-foreground">
                  pts
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-500",
                    leading ? "bg-primary" : "bg-primary/55",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 mb-0 text-[0.68rem] text-muted-foreground">
                {team.rosterCount} on roster
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
