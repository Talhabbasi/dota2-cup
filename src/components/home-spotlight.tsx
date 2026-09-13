import type { ReactNode } from "react";
import Link from "next/link";
import { formatDuration, formatMatchWhen } from "@/lib/data";
import { formatScheduleWhen } from "@/lib/schedule";
import { MatchTimeZones } from "@/components/match-timezones";
import type { MatchCardMatch } from "./match-card";

type TeamRef = { id: string; name: string };

function MatchFaceoff({
  radiant,
  dire,
  mid,
  linkTeams = true,
}: {
  radiant: TeamRef;
  dire: TeamRef;
  mid: ReactNode;
  linkTeams?: boolean;
}) {
  function TeamName({ team }: { team: TeamRef }) {
    if (linkTeams && team.id) {
      return (
        <Link href={`/teams/${team.id}`} className="spotlight-name">
          {team.name}
        </Link>
      );
    }
    return <span className="spotlight-name">{team.name}</span>;
  }

  return (
    <div className="spotlight-faceoff">
      <div className="spotlight-team radiant">
        <span className="spotlight-side">Radiant</span>
        <TeamName team={radiant} />
      </div>
      <div className="spotlight-vs">{mid}</div>
      <div className="spotlight-team dire">
        <span className="spotlight-side">Dire</span>
        <TeamName team={dire} />
      </div>
    </div>
  );
}

export function LatestMatchSpotlight({
  match,
}: {
  match: MatchCardMatch & { createdAt?: Date };
}) {
  const radiant = match.radiantTeam ?? { id: "", name: "Radiant" };
  const dire = match.direTeam ?? { id: "", name: "Dire" };
  const winner =
    match.winnerTeam?.name ??
    (match.radiantWin == null ? null : match.radiantWin ? radiant.name : dire.name);

  return (
    <Link href={`/matches/${match.id}`} className="spotlight-card spotlight-latest">
      <div className="spotlight-head">
        <span className="spotlight-badge">Latest match</span>
        <span className="spotlight-date">{formatMatchWhen(match.createdAt)}</span>
      </div>
      <MatchFaceoff
        radiant={radiant}
        dire={dire}
        linkTeams={false}
        mid={
          <>
            <span className="spotlight-mid-label">vs</span>
            <span className="spotlight-mid-meta">{formatDuration(match.duration)}</span>
            {winner ? <span className="spotlight-winner">{winner} win</span> : null}
          </>
        }
      />
    </Link>
  );
}

export function UpcomingMatchSpotlight({
  fixture,
}: {
  fixture: {
    radiantTeam: TeamRef;
    direTeam: TeamRef;
    scheduledAt?: Date;
    bestOf?: number;
    kind?: string;
  } | null;
}) {
  if (!fixture) return null;

  return (
    <div className="spotlight-card spotlight-upcoming">
      <div className="spotlight-head">
        <span className="spotlight-badge upcoming">Upcoming</span>
        <span className="spotlight-date">
          {fixture.scheduledAt
            ? formatScheduleWhen(fixture.scheduledAt)
            : "Not scheduled"}
        </span>
      </div>
      <MatchFaceoff
        radiant={fixture.radiantTeam}
        dire={fixture.direTeam}
        mid={
          <>
            <span className="spotlight-mid-label">vs</span>
            <span className="spotlight-mid-meta">
              {fixture.kind === "final"
                ? `Grand Final · BO${fixture.bestOf ?? 3}`
                : fixture.kind && fixture.kind !== "regular"
                  ? `${fixture.kind === "ub" ? "Upper bracket" : fixture.kind === "lb" ? "Elimination" : fixture.kind === "lb_final" ? "Elimination final" : fixture.kind === "group" ? "Group stage" : "Playoff"} · BO${fixture.bestOf ?? 1}`
                  : `Best of ${fixture.bestOf ?? 1}`}
            </span>
          </>
        }
      />
      {fixture.scheduledAt ? (
        <div className="spotlight-times">
          <p className="eyebrow">Kickoff</p>
          <MatchTimeZones at={fixture.scheduledAt} />
        </div>
      ) : null}
    </div>
  );
}
