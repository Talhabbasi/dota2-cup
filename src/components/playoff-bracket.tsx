import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import { playoffMatchesReady, type PlayoffMatchView, type PlayoffView } from "@/lib/playoff";

function TeamLink({
  team,
  winnerId,
}: {
  team: { id: string; name: string } | null;
  winnerId?: string | null;
}) {
  if (!team) return <span className="playoff-team playoff-tbd">TBD</span>;
  const won = winnerId === team.id;
  return (
    <Link
      href={`/teams/${team.id}`}
      className={won ? "playoff-team playoff-team-won" : "playoff-team"}
    >
      {team.name}
    </Link>
  );
}

function MatchCard({ match }: { match: PlayoffMatchView }) {
  const winnerId = match.winner?.id ?? null;
  const series =
    match.bestOf > 1
      ? `BO${match.bestOf}${
          match.status !== "empty"
            ? ` · ${match.radiantWins}–${match.direWins}`
            : ""
        }`
      : "BO1";

  return (
    <article
      className={
        match.status === "completed"
          ? "playoff-match playoff-match-done"
          : match.status === "scheduled"
            ? "playoff-match playoff-match-live"
            : "playoff-match"
      }
    >
      <div className="playoff-match-head">
        <span>{match.label}</span>
        <span className="muted">{series}</span>
      </div>
      <p className="playoff-matchup">
        <TeamLink team={match.radiant} winnerId={winnerId} />
        <span className="playoff-vs">vs</span>
        <TeamLink team={match.dire} winnerId={winnerId} />
      </p>
      {match.status === "completed" && match.winner ? (
        <p className="playoff-result">{match.winner.name} won</p>
      ) : match.scheduledAt ? (
        <p className="playoff-when">{formatScheduleWhen(match.scheduledAt)}</p>
      ) : (
        <p className="playoff-when muted">
          {match.kind === "group"
            ? "Not scheduled yet"
            : "Waiting for previous matches"}
        </p>
      )}
    </article>
  );
}

function GroupList({
  title,
  teams,
}: {
  title: string;
  teams: { id: string; name: string }[];
}) {
  return (
    <section className="playoff-group">
      <h2>{title}</h2>
      {teams.length === 0 ? (
        <p className="muted">Not assigned yet.</p>
      ) : (
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              <Link href={`/teams/${team.id}`}>{team.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PlayoffBracket({ view }: { view: PlayoffView }) {
  const bySlot = new Map(view.matches.map((match) => [match.slotKey, match]));
  const pick = (slot: PlayoffMatchView["slotKey"]) => bySlot.get(slot);

  return (
    <div className="playoff-board">
      <div className="playoff-groups">
        <GroupList title="Group A" teams={view.groupA} />
        <GroupList title="Group B" teams={view.groupB} />
      </div>
      {view.unassigned.length > 0 ? (
        <GroupList title="Unassigned" teams={view.unassigned} />
      ) : null}

      {!playoffMatchesReady(view) ? (
        <p className="muted playoff-later">
          Group matches are not scheduled yet.
        </p>
      ) : (
      <div className="playoff-rounds">
        <section className="playoff-round">
          <h2>Group stage</h2>
          <p className="muted">Each team plays one match.</p>
          <div className="playoff-round-grid">
            {(["group-a-1", "group-a-2", "group-b-1", "group-b-2"] as const).map(
              (slot) => {
                const match = pick(slot);
                return match ? <MatchCard key={slot} match={match} /> : null;
              },
            )}
          </div>
        </section>

        <section className="playoff-round">
          <h2>Playoffs</h2>
          <p className="muted">
            Match 1 winners play upper. Match 2 winners play elimination. Upper
            loser plays the elimination winner. Final is best of 3.
          </p>
          <div className="playoff-round-grid">
            {(["ub", "lb", "lb_final", "final"] as const).map((slot) => {
              const match = pick(slot);
              return match ? <MatchCard key={slot} match={match} /> : null;
            })}
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
