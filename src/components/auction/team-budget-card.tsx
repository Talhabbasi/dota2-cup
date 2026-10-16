"use client";

import { EsportsCard, TeamBadge } from "@/components/common";
import { displayTeamName } from "@/components/auction/team-purse-strip";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { MAX_ROSTER, STARTING_PURSE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TeamBudgetCard({
  name,
  purse,
  rosterCount,
  startingPurse = STARTING_PURSE,
  leading,
  className,
}: {
  name: string;
  purse: number;
  rosterCount: number;
  startingPurse?: number;
  leading?: boolean;
  className?: string;
}) {
  const label = displayTeamName(name);
  const remainingPct = Math.max(
    0,
    Math.min(100, Math.round((purse / Math.max(1, startingPurse)) * 100)),
  );

  return (
    <EsportsCard
      interactive={false}
      className={cn(
        "flex h-full flex-col gap-3 p-4 transition-[border-color,box-shadow,background-color] duration-300",
        leading &&
          "border-primary/50 bg-primary/8 shadow-[0_0_18px_rgba(245,158,11,0.16)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TeamBadge name={label} size="md" wrapName className="min-w-0 flex-1" />
        {leading ? (
          <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[0.62rem] font-semibold tracking-wide text-primary uppercase">
            Leading
          </span>
        ) : null}
      </div>

      <div>
        <p className="m-0 text-[0.68rem] text-muted-foreground">Remaining budget</p>
        <p className="mt-0.5 mb-0 font-mono text-lg font-bold tabular-nums text-foreground sm:text-xl">
          {formatAuctionPoints(purse)}
          <span className="mx-1 font-sans text-xs font-normal text-muted-foreground">
            /
          </span>
          <span className="font-mono text-sm font-semibold text-muted-foreground">
            {formatAuctionPoints(startingPurse)}
          </span>
          <span className="ml-1 font-sans text-[0.65rem] font-normal text-muted-foreground">
            pts
          </span>
        </p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500",
            leading ? "bg-primary" : "bg-primary/55",
          )}
          style={{ width: `${remainingPct}%` }}
        />
      </div>

      <p className="m-0 text-[0.72rem] text-muted-foreground">
        Players purchased{" "}
        <span className="font-mono font-semibold text-foreground">
          {rosterCount}/{MAX_ROSTER}
        </span>
      </p>
    </EsportsCard>
  );
}

export function TeamBudgetOverview({
  teams,
  leadingTeamId,
  startingPurse = STARTING_PURSE,
  className,
}: {
  teams: {
    id: string;
    name: string;
    purse: number;
    rosterCount: number;
  }[];
  leadingTeamId?: string | null;
  startingPurse?: number;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="m-0 font-display text-base tracking-[0.12em] text-primary uppercase sm:text-lg">
            Team budget overview
          </h3>
          <p className="mt-1 mb-0 text-xs text-muted-foreground">
            Purse left and roster fill for every captain — visible to all.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {teams.length} teams
        </span>
      </header>

      {teams.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-white/12 px-4 py-8 text-sm text-muted-foreground">
          Teams appear when the auction pool opens.
        </p>
      ) : (
        <ul
          className={cn(
            "m-0 grid list-none gap-3 p-0",
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {teams.map((team) => (
            <li key={team.id} className="min-w-0">
              <TeamBudgetCard
                name={team.name}
                purse={team.purse}
                rosterCount={team.rosterCount}
                startingPurse={startingPurse}
                leading={team.id === leadingTeamId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** @deprecated Prefer TeamBudgetOverview on the live board. */
export function TeamBudgetList({
  teams,
  leadingTeamId,
  className,
}: {
  teams: {
    id: string;
    name: string;
    purse: number;
    rosterCount: number;
  }[];
  leadingTeamId?: string | null;
  className?: string;
}) {
  return (
    <TeamBudgetOverview
      teams={teams}
      leadingTeamId={leadingTeamId}
      className={className}
    />
  );
}
