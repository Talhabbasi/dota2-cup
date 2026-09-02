"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MAX_ROSTER,
  MEDAL_LABELS,
  MIN_ROSTER,
  type Medal,
} from "@/lib/constants";

export type TeamPlayerView = {
  id: string;
  steamName: string;
  medal: string;
  rolesLabel: string;
  playWindowLabel: string;
  isCaptain: boolean;
  isSub: boolean;
};

const MEDAL_ACCENT: Partial<Record<Medal, string>> = {
  immortal: "#c45cff",
  divine: "#e4b65c",
  ancient: "#5cb87a",
  legend: "#5b9fd4",
  archon: "#8b7ad8",
};

function initials(name: string) {
  const parts = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function PlayerCard({ player }: { player: TeamPlayerView }) {
  const medal = player.medal as Medal;
  const accent = MEDAL_ACCENT[medal] ?? "var(--gold)";

  return (
    <Link
      href={`/players/${player.id}`}
      className="team-player-card"
      style={{ "--player-accent": accent } as React.CSSProperties}
    >
      <div className="team-player-card-top">
        <span className="team-player-avatar" aria-hidden>
          {initials(player.steamName)}
        </span>
        <div className="team-player-badges">
          {player.isCaptain ? (
            <span className="team-chip team-chip-captain">Captain</span>
          ) : null}
          {player.isSub ? (
            <span className="team-chip team-chip-sub">Sub</span>
          ) : null}
        </div>
      </div>
      <h3 className="team-player-name">{player.steamName}</h3>
      <p className="team-player-meta">
        <span className="team-medal-pill">
          {MEDAL_LABELS[medal] ?? player.medal}
        </span>
        <span className="team-role-pill">{player.rolesLabel}</span>
        <span className="team-window-pill">{player.playWindowLabel}</span>
      </p>
      <span className="team-player-cta">View profile →</span>
    </Link>
  );
}

function OpenSlot({ label, variant }: { label: string; variant: "starter" | "sub" }) {
  return (
    <div className={`team-open-slot team-open-slot-${variant}`}>
      <span className="team-open-slot-icon" aria-hidden>
        +
      </span>
      <p className="team-open-slot-title">Open slot</p>
      <p className="team-open-slot-hint">{label}</p>
    </div>
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
  const pct = Math.round((playerCount / MAX_ROSTER) * 100);
  const rosterReady = starterCount >= MIN_ROSTER;

  return (
    <header className="team-hero">
      <div className="team-hero-glow" aria-hidden />
      <div className="team-hero-body">
        <p className="eyebrow">Franchise</p>
        <h1 className="team-hero-title">{teamName}</h1>
        <p className="team-hero-sub">
          {captainName ? (
            <>
              Captain <strong>{captainName}</strong>
            </>
          ) : (
            "No captain assigned"
          )}
          {playWindowLabel ? (
            <>
              {" "}
              · Weekends <strong>{playWindowLabel}</strong>
            </>
          ) : null}
        </p>

        <div className="team-hero-stats">
          <div className="team-stat-pill">
            <span className="team-stat-label">Roster</span>
            <strong>
              {playerCount}/{MAX_ROSTER}
            </strong>
          </div>
          <div className="team-stat-pill">
            <span className="team-stat-label">Starters</span>
            <strong>
              {starterCount}/{MIN_ROSTER}
            </strong>
          </div>
          <div className="team-stat-pill">
            <span className="team-stat-label">Subs</span>
            <strong>
              {subCount}/2
            </strong>
          </div>
          <div className="team-stat-pill">
            <span className="team-stat-label">Record</span>
            <strong>
              {wins}W–{losses}L
            </strong>
          </div>
        </div>

        <div className="team-roster-meter">
          <div className="team-roster-meter-head">
            <span>Roster fill</span>
            <span className={rosterReady ? "gold" : "muted"}>
              {rosterReady ? "Starting five ready" : `${MIN_ROSTER - starterCount} starter slots open`}
            </span>
          </div>
          <div className="team-roster-meter-track">
            <span
              className="team-roster-meter-fill"
              style={{ width: `${pct}%` }}
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
  const [view, setView] = useState<"starters" | "all">("all");
  const starterSlots = Array.from({ length: MIN_ROSTER }, (_, i) => starters[i] ?? null);
  const subSlots = Array.from({ length: 2 }, (_, i) => subs[i] ?? null);

  return (
    <section className="team-roster-panel">
      <div className="team-roster-panel-head">
        <div>
          <h2>Roster</h2>
          <p className="muted">
            Draft in Discord — any role mix within budget. Two bench subs max.
          </p>
        </div>
        <div className="team-view-toggle" role="tablist" aria-label="Roster view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "all"}
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            Full board
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "starters"}
            className={view === "starters" ? "active" : ""}
            onClick={() => setView("starters")}
          >
            Starters only
          </button>
        </div>
      </div>

      <div className="team-slot-section">
        <h3 className="team-slot-label">
          Starting five
          <span className="muted">{starters.length}/{MIN_ROSTER}</span>
        </h3>
        <div className="team-slot-grid">
          {starterSlots.map((player, i) =>
            player ? (
              <PlayerCard key={player.id} player={player} />
            ) : (
              <OpenSlot
                key={`open-starter-${i}`}
                variant="starter"
                label="Draft in #auction"
              />
            ),
          )}
        </div>
      </div>

      {view === "all" ? (
        <div className="team-slot-section">
          <h3 className="team-slot-label">
            Substitutes
            <span className="muted">{subs.length}/2</span>
          </h3>
          <div className="team-slot-grid team-slot-grid-subs">
            {subSlots.map((player, i) =>
              player ? (
                <PlayerCard key={player.id} player={player} />
              ) : (
                <OpenSlot
                  key={`open-sub-${i}`}
                  variant="sub"
                  label="6th & 7th picks"
                />
              ),
            )}
          </div>
        </div>
      ) : null}

      {starters.length === 0 && subs.length === 0 ? (
        <p className="team-roster-foot muted">
          No auction picks yet — captain plus Discord draft fills this board.
        </p>
      ) : null}
    </section>
  );
}
