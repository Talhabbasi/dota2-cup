"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import {
  EsportsCard,
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
  StatTile,
  TeamBadge,
} from "@/components/common";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MAX_ROSTER,
  MEDAL_LABELS,
  MIN_ROSTER,
  ROLE_SHORT,
  STARTING_ROLES,
  type Medal,
  type StartingRole,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export type TeamPlayerView = {
  id: string;
  steamName: string;
  medal: string;
  rolesLabel: string;
  roleKeys: string[];
  playWindowLabel: string;
  isCaptain: boolean;
  isSub: boolean;
};

function initials(name: string) {
  const parts = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function starterPos(player: TeamPlayerView, index: number): number {
  for (const role of STARTING_ROLES) {
    if (player.roleKeys.includes(role)) {
      const short = ROLE_SHORT[role as StartingRole];
      const n = Number(short);
      if (Number.isFinite(n) && n >= 1 && n <= 5) return n;
    }
  }
  return index + 1;
}

function medalLabel(medal: string) {
  return MEDAL_LABELS[medal as Medal] ?? medal;
}

function RosterPlayerRow({
  player,
  position,
}: {
  player: TeamPlayerView;
  position: string;
}) {
  return (
    <EsportsTableRow>
      <EsportsTableCell className="w-14 font-mono text-sm tabular-nums text-muted-foreground">
        {position}
      </EsportsTableCell>
      <EsportsTableCell>
        <Link
          href={`/players/${player.id}`}
          className="flex min-w-0 items-center gap-3 text-foreground!"
        >
          <Avatar className="size-8 bg-[#0a0d14] ring-1 ring-white/15">
            <AvatarFallback className="bg-transparent text-[0.62rem] font-bold tracking-[0.12em] text-foreground">
              {initials(player.steamName)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate font-medium">
            {player.steamName}
            {player.isCaptain ? (
              <Badge
                variant="outline"
                className="ml-2 border-amber-500/40 bg-amber-500/10 text-[0.58rem] tracking-[0.1em] text-amber-300 uppercase"
              >
                Captain
              </Badge>
            ) : null}
          </span>
        </Link>
      </EsportsTableCell>
      <EsportsTableCell>
        <span className="team-medal-pill">{medalLabel(player.medal)}</span>
      </EsportsTableCell>
      <EsportsTableCell className="text-muted-foreground">
        {player.rolesLabel || "—"}
      </EsportsTableCell>
      <EsportsTableCell className="hidden text-muted-foreground sm:table-cell">
        {player.playWindowLabel}
      </EsportsTableCell>
    </EsportsTableRow>
  );
}

function OpenSlotRow({ position }: { position: string }) {
  return (
    <EsportsTableRow className="opacity-60">
      <EsportsTableCell className="w-14 font-mono text-sm tabular-nums text-muted-foreground">
        {position}
      </EsportsTableCell>
      <EsportsTableCell colSpan={4} className="text-muted-foreground">
        Open slot
      </EsportsTableCell>
    </EsportsTableRow>
  );
}

export function TeamProfileHero({
  teamName,
  captainName,
  playerCount,
  starterCount,
  subCount,
  wins,
  losses,
  playWindowLabel,
}: {
  teamName: string;
  captainName: string | null;
  playerCount: number;
  starterCount: number;
  subCount: number;
  wins: number;
  losses: number;
  playWindowLabel?: string | null;
}) {
  const rosterReady = starterCount >= MIN_ROSTER;
  const fillPct = Math.round((playerCount / MAX_ROSTER) * 100);

  return (
    <header className="relative overflow-hidden rounded-xl border border-white/10 bg-[#121824]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(245,158,11,0.14),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Franchise</p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <TeamBadge name={teamName} size="lg" showName={false} />
              <h1 className="m-0 truncate font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {teamName}
              </h1>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {captainName ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/35 bg-amber-500/10 text-amber-300"
                >
                  <Crown className="size-3" aria-hidden />
                  Captain {captainName}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-white/15 text-muted-foreground">
                  No captain assigned
                </Badge>
              )}
              {playWindowLabel ? (
                <Badge variant="outline" className="border-white/15 text-muted-foreground">
                  {playWindowLabel}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className={cn(
                  "border-white/15",
                  rosterReady
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "text-muted-foreground",
                )}
              >
                {rosterReady
                  ? "Starting five ready"
                  : `${MIN_ROSTER - starterCount} starter slots open`}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Wins" value={wins} />
          <StatTile label="Losses" value={losses} />
          <StatTile label="Starters" value={`${starterCount}/${MIN_ROSTER}`} />
          <StatTile label="Roster" value={`${playerCount}/${MAX_ROSTER}`} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <span>Roster fill</span>
            <span className="font-mono tabular-nums text-foreground">
              {subCount}/2 subs · {fillPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-amber-500/80 transition-[width] duration-300"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export function TeamRosterBoard({
  starters,
  subs,
}: {
  starters: TeamPlayerView[];
  subs: TeamPlayerView[];
}) {
  const starterSlots = Array.from({ length: MIN_ROSTER }, (_, i) => {
    const player = starters[i] ?? null;
    return {
      player,
      position: player ? `Pos ${starterPos(player, i)}` : `Pos ${i + 1}`,
    };
  });
  const subSlots = Array.from({ length: 2 }, (_, i) => subs[i] ?? null);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className="section-head mb-3">
          <h2>Starting five</h2>
          <span className="muted">
            {starters.length}/{MIN_ROSTER}
          </span>
        </div>
        <EsportsTable>
          <EsportsTableHeader>
            <EsportsTableRow>
              <EsportsTableHead>Pos</EsportsTableHead>
              <EsportsTableHead>Player</EsportsTableHead>
              <EsportsTableHead>Medal</EsportsTableHead>
              <EsportsTableHead>Roles</EsportsTableHead>
              <EsportsTableHead className="hidden sm:table-cell">
                Window
              </EsportsTableHead>
            </EsportsTableRow>
          </EsportsTableHeader>
          <EsportsTableBody>
            {starterSlots.map((slot, i) =>
              slot.player ? (
                <RosterPlayerRow
                  key={slot.player.id}
                  player={slot.player}
                  position={slot.position}
                />
              ) : (
                <OpenSlotRow key={`open-starter-${i}`} position={slot.position} />
              ),
            )}
          </EsportsTableBody>
        </EsportsTable>
      </div>

      <div>
        <div className="section-head mb-3">
          <h2>Substitutes</h2>
          <span className="muted">{subs.length}/2</span>
        </div>
        {subs.length === 0 && starters.length === 0 ? (
          <EsportsCard interactive={false} className="p-5">
            <p className="m-0 text-sm text-muted-foreground">
              No players on this roster yet.
            </p>
          </EsportsCard>
        ) : (
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead>Slot</EsportsTableHead>
                <EsportsTableHead>Player</EsportsTableHead>
                <EsportsTableHead>Medal</EsportsTableHead>
                <EsportsTableHead>Roles</EsportsTableHead>
                <EsportsTableHead className="hidden sm:table-cell">
                  Window
                </EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {subSlots.map((player, i) =>
                player ? (
                  <RosterPlayerRow
                    key={player.id}
                    player={player}
                    position="SUB"
                  />
                ) : (
                  <OpenSlotRow key={`open-sub-${i}`} position="SUB" />
                ),
              )}
            </EsportsTableBody>
          </EsportsTable>
        )}
      </div>
    </section>
  );
}
