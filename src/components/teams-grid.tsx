"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EsportsCard, StatTile, TeamBadge } from "@/components/common";
import { Pagination, usePagedList } from "@/components/pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MAX_ROSTER, MIN_ROSTER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type FormDot = "W" | "L" | "·";

export type TeamCardView = {
  id: string;
  name: string;
  captainName: string | null;
  playerCount: number;
  starterCount: number;
  subCount: number;
  wins: number;
  losses: number;
  rank: number;
  playerNames: string[];
  form: FormDot[];
};

type SortKey = "standings" | "name" | "roster";

const STARTER_SLOTS = 5;

function playerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function FormDots({ form }: { form: FormDot[] }) {
  const dots = form.length > 0 ? form : Array.from({ length: 5 }, () => "·" as FormDot);
  return (
    <div className="flex items-center gap-1.5" aria-label="Recent form">
      {dots.map((dot, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full",
            dot === "W" && "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]",
            dot === "L" && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]",
            dot === "·" && "bg-white/15",
          )}
          title={dot === "·" ? "No result" : dot}
        />
      ))}
    </div>
  );
}

function PlayerStrip({ names }: { names: string[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Starting roster">
      {Array.from({ length: STARTER_SLOTS }, (_, i) => {
        const name = names[i];
        if (!name) {
          return (
            <span
              key={i}
              className="size-8 rounded-full border border-dashed border-white/15 bg-[#0a0d14]/60"
              aria-hidden
            />
          );
        }
        return (
          <Avatar key={i} size="sm" className="size-8 ring-1 ring-white/10" title={name}>
            <AvatarFallback className="bg-[#0a0d14] text-[0.58rem] font-semibold tracking-wide text-foreground">
              {playerInitials(name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

function TeamCard({ team }: { team: TeamCardView }) {
  const startersReady = team.starterCount >= MIN_ROSTER;
  const slotsOpen = Math.max(0, MIN_ROSTER - team.starterCount);

  return (
    <Link href={`/teams/${team.id}`} className="group block h-full">
      <EsportsCard className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              {team.rank > 0 ? (
                <span className="font-mono text-xs tabular-nums text-amber-400">
                  #{team.rank}
                </span>
              ) : null}
              <TeamBadge name={team.name} size="md" />
            </div>
            <p className="m-0 truncate text-sm text-muted-foreground">
              {team.captainName ? (
                <>👑 Captain {team.captainName}</>
              ) : (
                "No captain"
              )}
            </p>
          </div>
          <FormDots form={team.form} />
        </div>

        <PlayerStrip names={team.playerNames} />

        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Roster"
            value={`${team.playerCount}/${MAX_ROSTER}`}
            className="px-2.5 py-2"
          />
          <StatTile
            label="Record"
            value={`${team.wins}W–${team.losses}L`}
            className="px-2.5 py-2"
          />
          <StatTile
            label="Subs"
            value={`${team.subCount}/2`}
            className="px-2.5 py-2"
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
          <span
            className={cn(
              startersReady ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            {startersReady
              ? "Starting five ready"
              : `${slotsOpen} starter slot${slotsOpen === 1 ? "" : "s"} open`}
          </span>
          <span className="text-muted-foreground transition-colors group-hover:text-amber-400">
            View franchise →
          </span>
        </div>
      </EsportsCard>
    </Link>
  );
}

export function TeamsGrid({ teams }: { teams: TeamCardView[] }) {
  const [sort, setSort] = useState<SortKey>("standings");

  const sorted = useMemo(() => {
    const list = [...teams];
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "roster") {
      list.sort(
        (a, b) =>
          b.playerCount - a.playerCount || a.name.localeCompare(b.name),
      );
    } else {
      list.sort(
        (a, b) =>
          b.wins - a.wins ||
          b.playerCount - a.playerCount ||
          a.name.localeCompare(b.name),
      );
    }
    return list;
  }, [teams, sort]);

  const { page, pageCount, slice, setPage } = usePagedList(sorted, 9);

  return (
    <>
      <div className="teams-list-toolbar">
        <p className="muted teams-list-count">
          <strong>{teams.length}</strong> franchise
          {teams.length === 1 ? "" : "s"}
        </p>
        <div className="team-view-toggle" role="tablist" aria-label="Sort teams">
          <button
            type="button"
            role="tab"
            aria-selected={sort === "standings"}
            className={sort === "standings" ? "active" : ""}
            onClick={() => setSort("standings")}
          >
            Standings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "roster"}
            className={sort === "roster" ? "active" : ""}
            onClick={() => setSort("roster")}
          >
            Roster fill
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "name"}
            className={sort === "name" ? "active" : ""}
            onClick={() => setSort("name")}
          >
            A–Z
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slice.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} onPage={setPage} />
    </>
  );
}
