import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import type { PlayoffMatchView, PlayoffView } from "@/lib/playoff";

function TeamLink({
  team,
  fallback,
  winnerId,
  loserId,
}: {
  team: { id: string; name: string } | null;
  fallback: string;
  winnerId?: string | null;
  loserId?: string | null;
}) {
  if (!team) return <span className="playoff-team playoff-tbd">{fallback}</span>;
  const won = winnerId === team.id;
  const lost = loserId === team.id;
  return (
    <Link
      href={`/teams/${team.id}`}
      className={
        won
          ? "playoff-team playoff-team-won"
          : lost
            ? "playoff-team playoff-team-out"
            : "playoff-team"
      }
    >
      {team.name}
    </Link>
  );
}

function statusLabel(match: PlayoffMatchView) {
  if (match.displayStatus === "completed") return "Completed";
  if (match.displayStatus === "live") return "Live";
  if (match.displayStatus === "upcoming") return "Upcoming";
  return "Waiting";
}

function MatchCard({ match }: { match: PlayoffMatchView }) {
  const winnerId = match.winner?.id ?? null;
  const loserId = match.loser?.id ?? null;
  const stateClass =
    match.displayStatus === "completed"
      ? "playoff-match playoff-match-done"
      : match.displayStatus === "live"
        ? "playoff-match playoff-match-live"
        : match.displayStatus === "upcoming"
          ? "playoff-match playoff-match-next"
          : "playoff-match";

  return (
    <article className={stateClass}>
      <div className="playoff-match-head">
        <span>{match.label}</span>
        <span className="playoff-match-flags">
          <span className="playoff-format">{match.formatLabel}</span>
          <span className={`playoff-state playoff-state-${match.displayStatus}`}>
            {statusLabel(match)}
          </span>
        </span>
      </div>
      <p className="playoff-matchup">
        <TeamLink
          team={match.radiant}
          fallback={match.leftLabel}
          winnerId={winnerId}
          loserId={loserId}
        />
        <span className="playoff-vs">vs</span>
        <TeamLink
          team={match.dire}
          fallback={match.rightLabel}
          winnerId={winnerId}
          loserId={loserId}
        />
      </p>
      {match.scheduledAt ? (
        <p className="playoff-when">{formatScheduleWhen(match.scheduledAt)}</p>
      ) : (
        <p className="playoff-when muted">{match.waitingReason}</p>
      )}
      {match.displayStatus === "completed" && match.winner ? (
        <p className="playoff-result">
          {match.winner.name} won
          {match.loser && match.loserGoes === "Eliminated"
            ? ` · ${match.loser.name} eliminated`
            : ` · ${match.winnerGoes}`}
        </p>
      ) : (
        <p className="playoff-note muted">
          Winner → {match.winnerGoes}
          {" · "}
          Loser → {match.loserGoes}
        </p>
      )}
    </article>
  );
}

function Round({
  title,
  note,
  slots,
  matches,
}: {
  title: string;
  note?: string;
  slots: PlayoffMatchView["slotKey"][];
  matches: PlayoffMatchView[];
}) {
  const bySlot = new Map(matches.map((match) => [match.slotKey, match]));
  return (
    <section className="playoff-round">
      <h2>{title}</h2>
      {note ? <p className="muted">{note}</p> : null}
      <div className="playoff-round-grid">
        {slots.map((slot) => {
          const match = bySlot.get(slot);
          return match ? <MatchCard key={slot} match={match} /> : null;
        })}
      </div>
    </section>
  );
}

export function PlayoffBracket({ view }: { view: PlayoffView }) {
  return (
    <div className="playoff-board">
      {!view.groupStageComplete ? (
        <p className="muted playoff-later">
          Playoffs unlock after every Group A and Group B match is completed.
          4th place is eliminated. Group A 3rd plays Group B 3rd in a Bo1
          Advancement Match. See the <Link href="/schedule">schedule</Link>.
        </p>
      ) : view.eliminated.length > 0 ? (
        <p className="playoff-elim-banner">
          Eliminated after groups:{" "}
          {view.eliminated.map((team) => team.name).join(" · ")}
        </p>
      ) : null}

      <div className="playoff-rounds">
        <Round
          title="Advancement Match"
          note="Group A 3rd vs Group B 3rd. Bo1. Winner joins the playoffs; loser is eliminated."
          slots={["adv"]}
          matches={view.matches}
        />
        <Round
          title="Upper Bracket"
          note="Match 1: Group A 1st vs Group B 2nd. Match 2: Group B 1st vs Group A 2nd. Both Bo1."
          slots={["ub1", "ub2", "uf"]}
          matches={view.matches}
        />
        <Round
          title="Lower Bracket"
          note="Match 3 puts the Advancement winner against the Match 1 loser. All Bo1."
          slots={["lb1", "lb2", "lb_final"]}
          matches={view.matches}
        />
        <Round
          title="Grand Final"
          note="Upper Final winner vs Lower Final winner. Bo3. Winner is the champion."
          slots={["final"]}
          matches={view.matches}
        />
      </div>
    </div>
  );
}
