import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import type { PlayoffMatchView, PlayoffView } from "@/lib/playoff";
import { BracketNode } from "@/components/bracket-node";

function MatchCard({ match }: { match: PlayoffMatchView }) {
  return (
    <div className="grid gap-2">
      <BracketNode match={match} className="h-auto w-full" />
      {match.scheduledAt ? (
        <p className="m-0 text-xs text-muted-foreground">{formatScheduleWhen(match.scheduledAt)}</p>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">{match.waitingReason}</p>
      )}
      {match.displayStatus === "completed" && match.winner ? (
        <p className="m-0 text-sm text-amber-400">
          {match.winner.name} won
          {match.loser && match.loserGoes === "Eliminated"
            ? ` · ${match.loser.name} eliminated`
            : ` · ${match.winnerGoes}`}
        </p>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">
          Winner → {match.winnerGoes}
          {" · "}
          Loser → {match.loserGoes}
        </p>
      )}
    </div>
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
          4th place is eliminated. Each 3rd-place team waits for a crossover
          loser: A3 vs the A1–B2 loser, B3 vs the B1–A2 loser. See the{" "}
          <Link href="/schedule">schedule</Link>.
        </p>
      ) : view.eliminated.length > 0 ? (
        <p className="playoff-elim-banner">
          Eliminated after groups:{" "}
          {view.eliminated.map((team) => team.name).join(" · ")}
        </p>
      ) : null}

      <div className="playoff-rounds">
        <Round
          title="Upper Bracket"
          note="Match 1: Group A 1st vs Group B 2nd. Match 2: Group B 1st vs Group A 2nd. Both Bo1. Losers drop to Lower Round 1."
          slots={["ub1", "ub2", "uf"]}
          matches={view.matches}
        />
        <Round
          title="Lower Bracket"
          note="Group A 3rd waits for the Match 1 loser. Group B 3rd waits for the Match 2 loser. Those winners play, then the Upper Final loser. All Bo1."
          slots={["lb1", "lb2", "lb3", "lb_final"]}
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
