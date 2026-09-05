"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pagination, usePagedList } from "@/components/pagination";
import {
  MEDAL_LABELS,
  MEDALS,
  type Medal,
} from "@/lib/constants";

export type PlayerCardView = {
  id: string;
  steamName: string;
  discordName: string;
  medal: string;
  rolesLabel: string;
  roleKeys: string[];
  teamId: string | null;
  teamName: string | null;
  isCaptain: boolean;
  isSub: boolean;
  basePrice: number;
  playWindowLabel: string;
  createdAt: string;
};

const MEDAL_ACCENT: Partial<Record<Medal, string>> = {
  immortal: "#c45cff",
  divine: "#e4b65c",
  ancient: "#5cb87a",
  legend: "#5b9fd4",
  archon: "#8b7ad8",
  crusader: "#6b9e8a",
  guardian: "#7a8fa8",
  herald: "#a08070",
};

/** Cup schedule timezone — Pakistan Standard Time (UTC+5). */
const CUP_UTC_OFFSET_HOURS = 5;

type FilterKey = "all" | "unsigned" | "signed" | "captains";
type TimeFilterKey = "all" | "today" | "week" | "month";
type SortKey = "name" | "medal" | "price" | "newest" | "oldest";

function initials(name: string) {
  const parts = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function medalRank(medal: string) {
  const i = (MEDALS as readonly string[]).indexOf(medal);
  return i === -1 ? MEDALS.length : i;
}

function pktParts(date: Date) {
  const shifted = new Date(date.getTime() + CUP_UTC_OFFSET_HOURS * 3_600_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

function startOfPktDay(now: Date) {
  const { y, m, d } = pktParts(now);
  return new Date(Date.UTC(y, m, d) - CUP_UTC_OFFSET_HOURS * 3_600_000);
}

function registeredInRange(iso: string, filter: TimeFilterKey, now: Date) {
  if (filter === "all") return true;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return false;
  const dayStart = startOfPktDay(now);

  if (filter === "today") {
    return created >= dayStart;
  }
  if (filter === "week") {
    const { dow } = pktParts(now);
    // Monday-based week in PKT (Mon=1 … Sun=0 → treat Sun as 6)
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(dayStart.getTime() - daysFromMonday * 86_400_000);
    return created >= weekStart;
  }
  // month
  const { y, m } = pktParts(now);
  const monthStart = new Date(Date.UTC(y, m, 1) - CUP_UTC_OFFSET_HOURS * 3_600_000);
  return created >= monthStart;
}

function formatRegistered(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const shifted = new Date(d.getTime() + CUP_UTC_OFFSET_HOURS * 3_600_000);
  const month = shifted.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr = hour % 12 || 12;
  return `${month} ${day} · ${hr}:${minute} ${ampm} PKT`;
}

function PlayerCard({ player }: { player: PlayerCardView }) {
  const medal = player.medal as Medal;
  const accent = MEDAL_ACCENT[medal] ?? "var(--gold)";

  return (
    <Link
      href={`/players/${player.id}`}
      className="players-grid-card"
      style={{ "--player-accent": accent } as React.CSSProperties}
    >
      <div className="players-grid-card-top">
        <span className="players-grid-avatar" aria-hidden>
          {initials(player.steamName)}
        </span>
        <div className="players-grid-badges">
          {player.isCaptain ? (
            <span className="team-chip team-chip-captain">Captain</span>
          ) : null}
          {player.isSub ? (
            <span className="team-chip team-chip-sub">Sub</span>
          ) : null}
          {!player.teamId ? (
            <span className="players-chip-open">Open</span>
          ) : null}
        </div>
      </div>

      <h3 className="players-grid-name">{player.steamName}</h3>
      <p className="players-grid-discord">{player.discordName}</p>

      <div className="players-grid-meta">
        <span className="team-medal-pill">
          {MEDAL_LABELS[medal] ?? player.medal}
        </span>
        <span className="team-role-pill">{player.rolesLabel}</span>
        <span className="team-window-pill" title="Weekend availability">
          {player.playWindowLabel}
        </span>
      </div>

      <p className="players-grid-registered" title="Registration time">
        Registered {formatRegistered(player.createdAt)}
      </p>

      <div className="players-grid-foot">
        {player.teamName ? (
          <span className="players-grid-team">{player.teamName}</span>
        ) : (
          <span className="muted">Unsigned · auction pool</span>
        )}
        <span className="players-grid-price">{player.basePrice.toLocaleString()} pts</span>
      </div>

      <span className="players-grid-cta">View profile →</span>
    </Link>
  );
}

export function PlayersGrid({ players }: { players: PlayerCardView[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    let list = players.filter((p) => {
      if (filter === "unsigned" && p.teamId) return false;
      if (filter === "signed" && !p.teamId) return false;
      if (filter === "captains" && !p.isCaptain) return false;
      if (!registeredInRange(p.createdAt, timeFilter, now)) return false;
      if (!q) return true;
      return (
        p.steamName.toLowerCase().includes(q) ||
        p.discordName.toLowerCase().includes(q) ||
        (p.teamName?.toLowerCase().includes(q) ?? false) ||
        p.rolesLabel.toLowerCase().includes(q) ||
        p.playWindowLabel.toLowerCase().includes(q)
      );
    });

    list = [...list];
    if (sort === "medal") {
      list.sort(
        (a, b) =>
          medalRank(a.medal) - medalRank(b.medal) ||
          a.steamName.localeCompare(b.steamName),
      );
    } else if (sort === "price") {
      list.sort(
        (a, b) =>
          b.basePrice - a.basePrice || a.steamName.localeCompare(b.steamName),
      );
    } else if (sort === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.steamName.localeCompare(b.steamName),
      );
    } else if (sort === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          a.steamName.localeCompare(b.steamName),
      );
    } else {
      list.sort((a, b) => a.steamName.localeCompare(b.steamName));
    }
    return list;
  }, [players, query, filter, timeFilter, sort]);

  const unsigned = players.filter((p) => !p.teamId).length;
  const { page, pageCount, slice, setPage } = usePagedList(filtered, 12);

  return (
    <>
      <div className="players-list-toolbar">
        <label className="players-search">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            placeholder="Search name, role, team, window…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="players-toolbar-row">
          <div className="team-view-toggle" role="tablist" aria-label="Filter players">
            {(
              [
                ["all", "All"],
                ["unsigned", `Open (${unsigned})`],
                ["signed", "Signed"],
                ["captains", "Captains"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="team-view-toggle"
            role="tablist"
            aria-label="Filter by registration time"
          >
            {(
              [
                ["all", "All time"],
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={timeFilter === key}
                className={timeFilter === key ? "active" : ""}
                onClick={() => setTimeFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="team-view-toggle" role="tablist" aria-label="Sort players">
            {(
              [
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["name", "A–Z"],
                ["medal", "Medal"],
                ["price", "Floor price"],
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
      </div>

      <p className="muted players-result-count">
        Showing <strong>{slice.length}</strong> of {filtered.length}
        {filtered.length !== players.length ? ` (filtered from ${players.length})` : ""}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            No players match your search.
          </p>
        </div>
      ) : (
        <>
          <div className="players-grid-enhanced">
            {slice.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </>
  );
}
