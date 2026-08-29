"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MAX_ROSTER, MIN_ROSTER } from "@/lib/constants";

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
};

type SortKey = "standings" | "name" | "roster";

function teamMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function TeamCard({ team }: { team: TeamCardView }) {
  const fillPct = Math.round((team.playerCount / MAX_ROSTER) * 100);
  const startersReady = team.starterCount >= MIN_ROSTER;
  const slotsOpen = Math.max(0, MIN_ROSTER - team.starterCount);

  return (
    <Link href={`/teams/${team.id}`} className="teams-grid-card">
      <div className="teams-grid-card-accent" aria-hidden />
      <div className="teams-grid-card-head">
        <span className="teams-grid-monogram" aria-hidden>
          {teamMonogram(team.name)}
        </span>
        <div className="teams-grid-card-titles">
          <div className="teams-grid-rank-row">
            {team.rank > 0 ? (
              <span className="teams-grid-rank">#{team.rank}</span>
            ) : null}
            <h2>{team.name}</h2>
          </div>
          <p className="teams-grid-captain">
            {team.captainName ? (
              <>
                Captain <strong>{team.captainName}</strong>
              </>
            ) : (
              "No captain"
            )}
          </p>
        </div>
      </div>

      <div className="teams-grid-stats">
        <div className="teams-grid-stat">
          <span className="label">Roster</span>
          <strong>
            {team.playerCount}/{MAX_ROSTER}
          </strong>
        </div>
        <div className="teams-grid-stat">
          <span className="label">Record</span>
          <strong>
            {team.wins}W–{team.losses}L
          </strong>
        </div>
        <div className="teams-grid-stat">
          <span className="label">Subs</span>
          <strong>{team.subCount}/2</strong>
        </div>
      </div>

      <div className="teams-grid-meter">
        <div className="teams-grid-meter-head">
          <span className="muted">Roster fill</span>
          <span className={startersReady ? "gold" : "muted"}>
            {startersReady
              ? "Starting five ready"
              : `${slotsOpen} starter slot${slotsOpen === 1 ? "" : "s"} open`}
          </span>
        </div>
        <div className="team-roster-meter-track">
          <span
            className="team-roster-meter-fill"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      <div className="teams-grid-mini-slots" aria-hidden>
        {Array.from({ length: MAX_ROSTER }, (_, i) => (
          <span
            key={i}
            className={i < team.playerCount ? "filled" : "open"}
          />
        ))}
      </div>

      <span className="teams-grid-cta">View franchise →</span>
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

  return (
    <>
      <div className="teams-list-toolbar">
        <p className="muted teams-list-count">
          <strong>{teams.length}</strong> franchise{teams.length === 1 ? "" : "s"}
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

      <div className="teams-grid-enhanced">
        {sorted.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </>
  );
}
