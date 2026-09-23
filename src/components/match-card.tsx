"use client";

import { memo } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import {
  EsportsCard,
  FactionBadge,
  MatchStatusBadge,
  TeamBadge,
} from "@/components/common";
import { formatMatchWhen } from "@/lib/format";
import { matchKillTotals, type MatchPlayerKills } from "@/lib/match-score";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MatchCardMatch = {
  id: string;
  openDotaId?: string;
  duration?: number | null;
  radiantWin?: boolean | null;
  radiantTeam?: { id: string; name: string } | null;
  direTeam?: { id: string; name: string } | null;
  winnerTeam?: { id: string; name: string } | null;
  players?: MatchPlayerKills[];
  radiantScore?: number | null;
  direScore?: number | null;
  createdAt?: Date | string;
  bestOf?: number | null;
  scheduledFixture?: { bestOf: number } | null;
};

function MatchSide({
  name,
  side,
  won,
  lost,
}: {
  name: string;
  side: "radiant" | "dire";
  won: boolean;
  lost: boolean;
}) {
  const radiant = side === "radiant";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        radiant ? "items-start" : "items-start md:items-end",
      )}
    >
      <FactionBadge side={side} showIcon={false} />
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          !radiant && "md:flex-row-reverse",
          won && "[&_span]:font-semibold! [&_span]:text-white!",
          lost && "[&_span]:text-slate-500!",
        )}
      >
        {won ? <Trophy className="size-3.5 shrink-0 text-amber-400" aria-hidden /> : null}
        <TeamBadge name={name} side={side} showName size="md" />
      </div>
    </div>
  );
}

export const MatchCard = memo(function MatchCard({
  match,
  showDate = false,
  kicker,
}: {
  match: MatchCardMatch;
  showDate?: boolean;
  kicker?: string;
}) {
  const radiant = match.radiantTeam?.name ?? "Radiant";
  const dire = match.direTeam?.name ?? "Dire";
  const radiantWon = match.winnerTeam?.id
    ? match.winnerTeam.id === match.radiantTeam?.id
    : match.radiantWin === true;
  const direWon = match.winnerTeam?.id
    ? match.winnerTeam.id === match.direTeam?.id
    : match.radiantWin === false;
  const finished = radiantWon || direWon;
  const bestOf = match.bestOf ?? match.scheduledFixture?.bestOf ?? 1;

  const { radiantKills, direKills, hasScore } = matchKillTotals(match.players, {
    radiantScore: match.radiantScore,
    direScore: match.direScore,
  });

  return (
    <Link
      href={`/matches/${match.id}`}
      aria-label={`${radiant} versus ${dire} match details`}
      className="group block"
    >
      <EsportsCard className="relative px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {kicker || (showDate && match.createdAt) ? (
              <div className="mb-3 flex items-center justify-between gap-3">
                {kicker ? (
                  <span className="text-[0.65rem] font-semibold tracking-[0.16em] text-primary uppercase">
                    {kicker}
                  </span>
                ) : (
                  <span />
                )}
                {showDate && match.createdAt ? (
                  <span className="text-xs text-muted-foreground">
                    {formatMatchWhen(match.createdAt)}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              <MatchSide name={radiant} side="radiant" won={radiantWon} lost={direWon} />

              <div className="flex flex-col items-center gap-2">
                <p
                  className="m-0 font-mono text-xl font-bold tracking-wider tabular-nums"
                  aria-label={
                    hasScore
                      ? `Kill score ${radiantKills} to ${direKills}`
                      : "Score unavailable"
                  }
                >
                  {hasScore ? (
                    <>
                      <span
                        className={
                          radiantWon
                            ? "text-white"
                            : direWon
                              ? "text-slate-500"
                              : "text-foreground"
                        }
                      >
                        {radiantKills}
                      </span>
                      <span className="text-slate-600"> : </span>
                      <span
                        className={
                          direWon
                            ? "text-white"
                            : radiantWon
                              ? "text-slate-500"
                              : "text-foreground"
                        }
                      >
                        {direKills}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </p>
                {finished ? (
                  <MatchStatusBadge
                    status="completed"
                    label={`FT · Bo${bestOf}`}
                  />
                ) : (
                  <MatchStatusBadge status="live" />
                )}
              </div>

              <MatchSide name={dire} side="dire" won={direWon} lost={radiantWon} />
            </div>
          </div>

          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "pointer-events-none shrink-0 border-white/15 bg-transparent text-foreground shadow-none dark:border-white/15 dark:bg-transparent",
            )}
            aria-hidden
          >
            <ChevronRight />
          </span>
        </div>
      </EsportsCard>
    </Link>
  );
});
