"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type StandingRowView = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

type SortKey = "points" | "wins" | "name";

function teamMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function rankClass(rank: number) {
  return `standings-rank rank rank-${Math.min(rank, 4)}`;
}

function StandingRow({
  row,
  rank,
  compact,
}: {
  row: StandingRowView;
  rank: number;
  compact?: boolean;
}) {
  const winRate =
    row.played > 0 ? Math.round((row.wins / row.played) * 100) : null;

  return (
    <Link
      href={`/teams/${row.id}`}
      className={`standings-row ${compact ? "standings-row-compact" : ""}`}
    >
      <span className={rankClass(rank)} aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      <span className="standings-monogram" aria-hidden>
        {teamMonogram(row.name)}
      </span>
      <div className="standings-team">
        <strong>{row.name}</strong>
        {!compact ? (
          <span className="muted">
            {row.played} played
            {winRate != null ? ` · ${winRate}% wins` : ""}
          </span>
        ) : null}
      </div>
      <div className="standings-stats">
        <span className="standings-stat">
          <b>{row.played}</b>
          <small>P</small>
        </span>
        <span className="standings-stat">
          <b>{row.wins}</b>
          <small>W</small>
        </span>
        <span className="standings-stat">
          <b>{row.losses}</b>
          <small>L</small>
        </span>
      </div>
      <div className="standings-points">
        <strong>{row.points}</strong>
        <small>pts</small>
      </div>
      <span className="standings-row-cta">Team →</span>
    </Link>
  );
}

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

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort === "wins") {
      list.sort(
        (a, b) =>
          b.wins - a.wins ||
          b.points - a.points ||
          a.name.localeCompare(b.name),
      );
    } else if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name),
      );
    }
    return list;
  }, [rows, sort]);

  const visible = limit ? sorted.slice(0, limit) : sorted;
  const leader = sorted[0];
  const totalPlayed = rows.reduce((n, r) => n + r.played, 0);

  return (
    <div className={`standings-board ${compact ? "standings-board-compact" : ""}`}>
      {!compact ? (
        <div className="standings-board-toolbar">
          <p className="muted standings-board-meta">
            {leader ? (
              <>
                Leader <strong>{leader.name}</strong>
                {leader.points > 0 ? ` · ${leader.points} pts` : ""}
              </>
            ) : (
              "No results yet"
            )}
            {totalPlayed > 0 ? (
              <>
                {" "}
                · <strong>{totalPlayed}</strong> games logged
              </>
            ) : null}
          </p>
          <div className="team-view-toggle" role="tablist" aria-label="Sort standings">
            <button
              type="button"
              role="tab"
              aria-selected={sort === "points"}
              className={sort === "points" ? "active" : ""}
              onClick={() => setSort("points")}
            >
              Points
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sort === "wins"}
              className={sort === "wins" ? "active" : ""}
              onClick={() => setSort("wins")}
            >
              Wins
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
      ) : null}

      <div className="standings-board-head" aria-hidden>
        <span>#</span>
        <span />
        <span>Team</span>
        <span>P · W · L</span>
        <span>Pts</span>
        <span />
      </div>

      <div className="standings-board-list">
        {visible.length === 0 ? (
          <div className="standings-board-empty muted">
            Results land after the first posted match.
          </div>
        ) : (
          visible.map((row, i) => (
            <StandingRow
              key={row.id}
              row={row}
              rank={i + 1}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
}
