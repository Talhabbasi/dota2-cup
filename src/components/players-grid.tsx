"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EsportsCard,
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
  TeamBadge,
} from "@/components/common";
import { Pagination, usePagedList } from "@/components/pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MEDAL_LABELS,
  MEDALS,
  type Medal,
} from "@/lib/constants";

export type PlayerCardView = {
  id: string;
  steamName: string;
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

/** Cup schedule timezone — Pakistan Standard Time (UTC+5). */
const CUP_UTC_OFFSET_HOURS = 5;

type FilterKey = "all" | "unsigned" | "signed" | "captains";
type TimeFilterKey = "all" | "today" | "week" | "month";
type SortKey = "name" | "medal" | "price" | "newest" | "oldest";

function initials(name: string) {
  const parts = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
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
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(dayStart.getTime() - daysFromMonday * 86_400_000);
    return created >= weekStart;
  }
  const { y, m } = pktParts(now);
  const monthStart = new Date(Date.UTC(y, m, 1) - CUP_UTC_OFFSET_HOURS * 3_600_000);
  return created >= monthStart;
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
  const { page, pageCount, slice, setPage } = usePagedList(filtered, 20);

  return (
    <div className="flex flex-col gap-4">
      <EsportsCard interactive={false} className="flex flex-col gap-3 p-4 sm:p-5">
        <label className="players-search block max-w-lg">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            placeholder="Search name, role, team, window…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
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

        <p className="m-0 text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{slice.length}</strong> of{" "}
          {filtered.length}
          {filtered.length !== players.length
            ? ` (filtered from ${players.length})`
            : ""}
          {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
        </p>
      </EsportsCard>

      {filtered.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            No players match your search.
          </p>
        </div>
      ) : (
        <>
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead>Player</EsportsTableHead>
                <EsportsTableHead>Team</EsportsTableHead>
                <EsportsTableHead className="hidden md:table-cell">
                  Roles
                </EsportsTableHead>
                <EsportsTableHead>Medal</EsportsTableHead>
                <EsportsTableHead className="hidden text-right! sm:table-cell">
                  Floor
                </EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {slice.map((player) => {
                const medal = player.medal as Medal;
                return (
                  <EsportsTableRow key={player.id}>
                    <EsportsTableCell>
                      <Link
                        href={`/players/${player.id}`}
                        className="flex min-w-0 items-center gap-3 text-foreground!"
                      >
                        <Avatar className="size-8 shrink-0 bg-[#0a0d14] ring-1 ring-white/15">
                          <AvatarFallback className="bg-transparent text-[0.62rem] font-bold tracking-[0.12em]">
                            {initials(player.steamName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {player.steamName}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {player.isCaptain ? (
                              <Badge
                                variant="outline"
                                className="h-4 border-amber-500/40 bg-amber-500/10 px-1.5 text-[0.55rem] tracking-[0.08em] text-amber-300 uppercase"
                              >
                                Captain
                              </Badge>
                            ) : null}
                            {player.isSub ? (
                              <Badge
                                variant="outline"
                                className="h-4 border-white/15 px-1.5 text-[0.55rem] tracking-[0.08em] text-muted-foreground uppercase"
                              >
                                Sub
                              </Badge>
                            ) : null}
                            {!player.teamId ? (
                              <Badge
                                variant="outline"
                                className="h-4 border-cyan-500/30 bg-cyan-500/10 px-1.5 text-[0.55rem] tracking-[0.08em] text-cyan-300 uppercase"
                              >
                                Open
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                    </EsportsTableCell>
                    <EsportsTableCell>
                      {player.teamName && player.teamId ? (
                        <Link
                          href={`/teams/${player.teamId}`}
                          className="text-foreground!"
                        >
                          <TeamBadge name={player.teamName} size="sm" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unsigned
                        </span>
                      )}
                    </EsportsTableCell>
                    <EsportsTableCell className="hidden text-muted-foreground md:table-cell">
                      {player.rolesLabel || "—"}
                    </EsportsTableCell>
                    <EsportsTableCell>
                      <span className="team-medal-pill">
                        {MEDAL_LABELS[medal] ?? player.medal}
                      </span>
                    </EsportsTableCell>
                    <EsportsTableCell className="hidden text-right! font-mono text-sm tabular-nums text-muted-foreground sm:table-cell">
                      {player.basePrice.toLocaleString()}
                    </EsportsTableCell>
                  </EsportsTableRow>
                );
              })}
            </EsportsTableBody>
          </EsportsTable>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  );
}
