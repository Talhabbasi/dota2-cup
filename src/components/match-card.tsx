import Link from "next/link";
import { formatDuration, formatMatchWhen } from "@/lib/data";
import {
  formatKillScore,
  matchKillTotals,
  type MatchPlayerKills,
} from "@/lib/match-score";

export type MatchCardMatch = {
  id: string;
  openDotaId?: string;
  duration?: number | null;
  radiantWin?: boolean | null;
  radiantTeam?: { id: string; name: string } | null;
  direTeam?: { id: string; name: string } | null;
  winnerTeam?: { id: string; name: string } | null;
  players?: MatchPlayerKills[];
  createdAt?: Date | string;
};

export function MatchCard({
  match,
  showDate = false,
}: {
  match: MatchCardMatch;
  showDate?: boolean;
}) {
  const radiant = match.radiantTeam?.name ?? "Radiant";
  const dire = match.direTeam?.name ?? "Dire";
  const winner =
    match.winnerTeam?.name ??
    (match.radiantWin == null
      ? null
      : match.radiantWin
        ? radiant
        : dire);
  const radiantWon =
    match.winnerTeam?.id
      ? match.winnerTeam.id === match.radiantTeam?.id
      : match.radiantWin === true;
  const direWon =
    match.winnerTeam?.id
      ? match.winnerTeam.id === match.direTeam?.id
      : match.radiantWin === false;

  const { radiantKills, direKills, hasScore } = matchKillTotals(match.players);
  const killLine = hasScore
    ? formatKillScore(radiantKills, direKills)
    : null;

  return (
    <Link href={`/matches/${match.id}`} className="match-card-enhanced">
      {showDate && match.createdAt ? (
        <span className="match-card-date">{formatMatchWhen(match.createdAt)}</span>
      ) : null}

      <div className={`match-card-side radiant ${radiantWon ? "won" : ""}`}>
        <span className="match-card-lane side-r">Radiant</span>
        <strong className="match-card-team">{radiant}</strong>
        {hasScore ? (
          <span className="match-card-side-kills">{radiantKills}</span>
        ) : null}
      </div>

      <div className="match-card-center">
        {killLine ? (
          <span className="match-card-score" aria-label={`Kill score ${killLine}`}>
            <span className={radiantWon ? "leading" : ""}>{radiantKills}</span>
            <span className="match-card-score-sep">:</span>
            <span className={direWon ? "leading" : ""}>{direKills}</span>
          </span>
        ) : (
          <span className="match-card-score muted">—</span>
        )}
        <span className="match-card-vs">vs</span>
        <span className="match-card-duration">{formatDuration(match.duration)}</span>
        {winner ? (
          <span className={`match-card-winner ${direWon ? "dire-win" : "radiant-win"}`}>
            {winner} win
          </span>
        ) : null}
      </div>

      <div className={`match-card-side dire ${direWon ? "won" : ""}`}>
        <span className="match-card-lane side-d">Dire</span>
        <strong className="match-card-team">{dire}</strong>
        {hasScore ? (
          <span className="match-card-side-kills">{direKills}</span>
        ) : null}
      </div>

      <span className="match-card-cta">Match details →</span>
    </Link>
  );
}
