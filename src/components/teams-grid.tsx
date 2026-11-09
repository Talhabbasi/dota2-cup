"use client";

import Link from "next/link";
import { useState } from "react";
import { RosterAvatar } from "@/components/avatar/roster-avatar";
import { teamKitsFor, type TeamKit } from "@/lib/avatar/roster";

export type TeamCardView = {
  id: string;
  name: string;
  players: { id: string; name: string; role: string; avatarConfig?: string | null }[];
};

export type TeamSeasonSection = {
  id: string;
  label: string;
  note: string;
  teams: TeamCardView[];
  empty: string;
};

function TeamRow({ team, kit }: { team: TeamCardView; kit: TeamKit }) {
  return (
    <article className="team-showcase">
      <h3>
        <Link href={`/teams/${team.id}`}>{team.name}</Link>
      </h3>
      {team.players.length === 0 ? (
        <p className="team-showcase-empty">No roster saved for this franchise.</p>
      ) : (
        <div className="team-showcase-row">
          {team.players.map((player) => (
            <figure key={player.id} className="team-portrait">
              <RosterAvatar playerId={player.id} saved={player.avatarConfig} kit={kit}
                name={player.name} className="team-generated-avatar" />
              <figcaption>
                <span>{player.role}</span>
                <strong>{player.name}</strong>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}

function TeamStack({ teams }: { teams: TeamCardView[] }) {
  const kits = teamKitsFor(teams.map((row) => row.id));
  return (
    <div className="team-showcase-stack">
      {teams.map((team) => (
        <TeamRow key={team.id} team={team} kit={kits.get(team.id)!} />
      ))}
    </div>
  );
}

export function TeamSeasonTabs({ sections }: { sections: TeamSeasonSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  if (!active) return null;

  return (
    <div>
      <div className="team-view-toggle team-season-tabs" role="tablist" aria-label="Season teams">
        {sections.map((section) => {
          const on = section.id === active.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? "active" : ""}
              onClick={() => setActiveId(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </div>
      <p className="team-season-note">{active.note}</p>
      {active.teams.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{active.empty}</p>
      ) : (
        <TeamStack teams={active.teams} />
      )}
    </div>
  );
}
