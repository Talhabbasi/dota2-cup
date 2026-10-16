"use client";

import { useMemo, useState } from "react";
import { EsportsCard, TeamBadge } from "@/components/common";
import { SoldPlayerCard, type SoldPlayerCardData } from "@/components/auction/sold-player-card";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { STARTING_PURSE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type AuctionResultsTeamSummary = {
  id: string;
  name: string;
  purse: number;
  players: SoldPlayerCardData[];
};

type SortKey = "price-desc" | "price-asc" | "mmr-desc" | "name";
type SoldFilter = "all" | "sold" | "unsold";

const MEDAL_RANK: Record<string, number> = {
  immortal: 9,
  divine: 8,
  ancient: 7,
  legend: 6,
  archon: 5,
  crusader: 4,
  guardian: 3,
  herald: 2,
  uncalibrated: 1,
};

export function AuctionResultsClient({
  players,
  teams,
  className,
}: {
  players: SoldPlayerCardData[];
  teams: AuctionResultsTeamSummary[];
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("all");
  const [role, setRole] = useState("all");
  const [soldFilter, setSoldFilter] = useState<SoldFilter>("all");
  const [sort, setSort] = useState<SortKey>("price-desc");

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      for (const part of p.rolesLabel.split(/[,/]/).map((s) => s.trim()).filter(Boolean)) {
        set.add(part);
      }
    }
    return [...set].sort();
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = players.filter((p) => {
      if (q && !p.playerName.toLowerCase().includes(q)) return false;
      if (teamId !== "all" && p.teamId !== teamId) return false;
      if (role !== "all" && !p.rolesLabel.toLowerCase().includes(role.toLowerCase()))
        return false;
      if (soldFilter === "sold" && !p.sold) return false;
      if (soldFilter === "unsold" && p.sold) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.playerName.localeCompare(b.playerName);
      if (sort === "mmr-desc") {
        return (
          (MEDAL_RANK[b.medalLabel.toLowerCase()] ?? 0) -
          (MEDAL_RANK[a.medalLabel.toLowerCase()] ?? 0)
        );
      }
      const pa = a.soldPrice ?? 0;
      const pb = b.soldPrice ?? 0;
      return sort === "price-asc" ? pa - pb : pb - pa;
    });
    return rows;
  }, [players, query, teamId, role, soldFilter, sort]);

  const controlClass =
    "h-9 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <div className={cn("grid gap-8", className)}>
      <EsportsCard interactive={false} className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Player name"
              className={controlClass}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Team
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={controlClass}
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={controlClass}
            >
              <option value="all">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Status
            <select
              value={soldFilter}
              onChange={(e) => setSoldFilter(e.target.value as SoldFilter)}
              className={controlClass}
            >
              <option value="all">Sold & unsold</option>
              <option value="sold">Sold only</option>
              <option value="unsold">Unsold only</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={controlClass}
            >
              <option value="price-desc">Price · high</option>
              <option value="price-asc">Price · low</option>
              <option value="mmr-desc">Rank medal</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </EsportsCard>

      {filtered.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted m-0">No players match these filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((player) => (
            <SoldPlayerCard key={player.playerId} player={player} />
          ))}
        </div>
      )}

      <section>
        <div className="section-head mb-3">
          <h2>Team summary</h2>
          <span className="muted">Purchased players & remaining budget</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map((team) => (
            <EsportsCard key={team.id} interactive={false} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TeamBadge name={team.name} size="md" />
                <p className="m-0 font-mono text-sm tabular-nums">
                  {formatAuctionPoints(team.purse)} /{" "}
                  {formatAuctionPoints(STARTING_PURSE)} left
                </p>
              </div>
              {team.players.length === 0 ? (
                <p className="mt-3 mb-0 text-sm text-muted-foreground">
                  No purchases yet.
                </p>
              ) : (
                <ul className="mt-3 mb-0 list-none space-y-1.5 p-0">
                  {team.players.map((p) => (
                    <li
                      key={p.playerId}
                      className="flex justify-between gap-2 rounded-md border border-white/5 px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{p.playerName}</span>
                      <span className="font-mono tabular-nums text-primary">
                        {p.soldPrice != null
                          ? formatAuctionPoints(p.soldPrice)
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </EsportsCard>
          ))}
        </div>
      </section>
    </div>
  );
}
