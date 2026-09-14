import Link from "next/link";
import { MatchTimeZones } from "@/components/match-timezones";
import { KICKOFF_SHORT } from "@/lib/play-window";
import { weekendSlotLabel } from "@/lib/match-times";
import { isPlayoffKind, playoffRoundLabel } from "@/lib/playoff";
import { formatScheduleWhen, kickoffWindowFromDate } from "@/lib/schedule";

type Fixture = {
  id: string;
  slotIndex: number;
  status: string;
  scheduledAt: Date;
  kind?: string;
  slotKey?: string | null;
  bestOf?: number;
  radiantWins?: number;
  direWins?: number;
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
  match?: { winnerTeam?: { id: string; name: string } | null } | null;
};

export function WeekendScheduleBlock({
  weekendIndex,
  fixtures,
}: {
  weekendIndex: number;
  fixtures: Fixture[];
  champion?: { id: string; name: string; count: number } | null;
}) {
  const nextFixture = fixtures.find((f) => f.status === "scheduled");
  const isFinal = fixtures.some((f) => f.kind === "final");
  const isPlayoff = fixtures.some((f) => isPlayoffKind(f.kind));

  return (
    <section className="weekend-schedule">
      <div className="weekend-board">
        <div className="section-head row">
          <h2>
            {isFinal
              ? "Grand Final"
              : isPlayoff
                ? "This weekend"
                : `Weekend ${weekendIndex + 1}`}
          </h2>
          <Link href="/schedule" className="text-link">
            Full schedule
          </Link>
        </div>
        <p className="weekend-rule muted">
          {isFinal
            ? "Upper Final winner vs Lower Final winner. Bo3, first to 2."
            : isPlayoff
              ? "Saturday and Sunday only. Group stage 10:00 PM–6:00 AM PKT; playoffs 10:00 AM–3:00 AM PKT."
              : "Saturday and Sunday only. Kickoff slots are 10:00 PM through 6:00 AM PKT."}
        </p>

        <div className="weekend-grid">
          {fixtures.map((fixture) => {
            const winner = fixture.match?.winnerTeam?.name;
            const isNext = nextFixture?.id === fixture.id;
            const bestOf = fixture.bestOf ?? 1;
            return (
              <article
                key={fixture.id}
                className={isNext ? "weekend-card weekend-card-next" : "weekend-card"}
              >
                <div className="weekend-card-head">
                  <span className="weekend-day">
                    {isPlayoffKind(fixture.kind)
                      ? playoffRoundLabel(fixture.kind, fixture.slotKey)
                      : weekendSlotLabel(fixture.slotIndex)}
                    {" · "}
                    {KICKOFF_SHORT[kickoffWindowFromDate(fixture.scheduledAt)]}
                  </span>
                  {winner && fixture.status === "completed" ? (
                    <span className="weekend-status weekend-status-won">Won</span>
                  ) : isNext ? (
                    <span className="weekend-status weekend-status-next">Up next</span>
                  ) : (
                    <span className="weekend-status">
                      {bestOf > 1
                        ? `BO${bestOf} ${fixture.radiantWins ?? 0}–${fixture.direWins ?? 0}`
                        : "BO1"}
                    </span>
                  )}
                </div>
                <p className="weekend-matchup">
                  <Link
                    className="weekend-team"
                    href={`/teams/${fixture.radiantTeam.id}`}
                  >
                    {fixture.radiantTeam.name}
                  </Link>
                  <span className="weekend-vs">vs</span>
                  <Link className="weekend-team" href={`/teams/${fixture.direTeam.id}`}>
                    {fixture.direTeam.name}
                  </Link>
                </p>
                <p className="weekend-pkt">{formatScheduleWhen(fixture.scheduledAt)}</p>
                {winner && fixture.status === "completed" ? (
                  <p className="weekend-result gold">{winner} won</p>
                ) : null}
              </article>
            );
          })}
        </div>

        {nextFixture ? (
          <div className="weekend-times-panel">
            <p className="eyebrow">Kickoff times — next match</p>
            <MatchTimeZones at={nextFixture.scheduledAt} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
