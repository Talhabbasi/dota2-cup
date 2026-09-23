"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
  TeamBadge,
} from "@/components/common";
import { cn } from "@/lib/utils";

export type StandingRowView = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

type SortKey = "points" | "wins" | "name";

function byPoints(a: StandingRowView, b: StandingRowView) {
  return b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name);
}

function rowTone(rank: number) {
  if (rank <= 2) return "bg-amber-500/5";
  if (rank <= 4) return "bg-cyan-400/5";
  return "opacity-50";
}

function rowEdge(rank: number) {
  if (rank <= 2) return "border-l-4! border-l-amber-500!";
  if (rank <= 4) return "border-l-4! border-l-cyan-400!";
  return "border-l-4! border-l-transparent!";
}

type RankedStanding = StandingRowView & { rank: number };

const StandingTableRow = memo(function StandingTableRow({
  row,
  compact,
}: {
  row: RankedStanding;
  compact: boolean;
}) {
  const winRate =
    row.played > 0 ? Math.round((row.wins / row.played) * 100) : null;

  return (
    <EsportsTableRow className={rowTone(row.rank)}>
      <EsportsTableCell
        className={cn(
          "w-12 font-mono text-sm tabular-nums text-muted-foreground",
          rowEdge(row.rank),
        )}
      >
        {row.rank}
      </EsportsTableCell>
      <EsportsTableCell>
        <Link
          href={`/teams/${row.id}`}
          className="flex min-w-0 flex-col gap-0.5 text-foreground!"
        >
          <TeamBadge name={row.name} />
          {!compact ? (
            <span className="pl-11.5 text-xs text-muted-foreground sm:pl-12">
              {row.played} played
              {winRate != null ? ` · ${winRate}% wins` : ""}
            </span>
          ) : null}
        </Link>
      </EsportsTableCell>
      {(
        [
          ["played", row.played],
          ["wins", row.wins],
          ["losses", row.losses],
        ] as const
      ).map(([key, value]) => (
        <EsportsTableCell
          key={key}
          className="text-right! font-mono text-sm tabular-nums"
        >
          {value}
        </EsportsTableCell>
      ))}
      <EsportsTableCell className="text-right! font-mono text-sm font-bold tabular-nums text-amber-400">
        {row.points}
      </EsportsTableCell>
    </EsportsTableRow>
  );
});

export function StandingsBoard({
  rows,
  compact = false,
  limit,
}: {
  rows: StandingRowView[];
  compact?: boolean;
  limit?: number;
}) {
  const [sort, setSort] = useState<SortKey>("points");

  const ranked = useMemo(() => {
    const byStanding = [...rows].sort(byPoints);
    const rankOf = new Map(byStanding.map((row, index) => [row.id, index + 1]));
    const list = [...rows];
    if (sort === "wins") {
      list.sort(
        (a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name),
      );
    } else if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort(byPoints);
    }
    return list.map((row) => ({ ...row, rank: rankOf.get(row.id) ?? rows.length }));
  }, [rows, sort]);

  const visible = limit ? ranked.slice(0, limit) : ranked;
  const leader = [...rows].sort(byPoints)[0];
  const totalPlayed = rows.reduce((n, row) => n + row.played, 0);

  return (
    <div>
      {!compact ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {leader ? (
              <>
                Leader <strong className="text-foreground">{leader.name}</strong>
                {leader.points > 0 ? ` · ${leader.points} pts` : ""}
              </>
            ) : (
              "No results yet"
            )}
            {totalPlayed > 0 ? (
              <>
                {" "}
                · <strong className="text-foreground">{totalPlayed}</strong> games logged
              </>
            ) : null}
          </p>
          <div className="team-view-toggle" role="tablist" aria-label="Sort standings">
            {(
              [
                ["points", "Points"],
                ["wins", "Wins"],
                ["name", "A–Z"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={sort === key}
                className={sort === key ? "active" : ""}
                onClick={() => setSort(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#121824] px-4 py-6 text-center text-sm text-muted-foreground">
          Results land after the first posted match.
        </div>
      ) : (
        <EsportsTable>
          <EsportsTableHeader>
            <EsportsTableRow className="hover:bg-transparent">
              <EsportsTableHead className="w-12">#</EsportsTableHead>
              <EsportsTableHead>Team</EsportsTableHead>
              {["P", "W", "L", "PTS"].map((label) => (
                <EsportsTableHead key={label} className="text-right!">
                  {label}
                </EsportsTableHead>
              ))}
            </EsportsTableRow>
          </EsportsTableHeader>
          <EsportsTableBody>
            {visible.map((row) => (
              <StandingTableRow key={row.id} row={row} compact={compact} />
            ))}
          </EsportsTableBody>
        </EsportsTable>
      )}
    </div>
  );
}
