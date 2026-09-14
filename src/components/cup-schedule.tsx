import Link from "next/link";
import { MatchTimeZones } from "@/components/match-timezones";
import { isPlayoffKind, playoffRoundLabel } from "@/lib/playoff";
import { formatScheduleWhen } from "@/lib/schedule";
import {
  groupScheduleByNight,
  type ScheduleFixtureView,
} from "@/lib/schedule-crud";

export function CupScheduleBoard({
  fixtures,
}: {
  fixtures: ScheduleFixtureView[];
}) {
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");
  const nights = groupScheduleByNight(fixtures);
  const nextId = upcoming[0]?.id;

  if (nights.length === 0) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          No matches booked yet. Admins use{" "}
          <strong>/schedule add</strong> in Discord (Saturday or Sunday).
          Group stage: 10:00 PM–6:00 AM PKT. Playoffs: 10:00 AM–3:00 AM PKT.
        </p>
      </div>
    );
  }

  return (
    <div className="cup-schedule">
      {nights.map((night) => (
        <section key={night.label} className="weekend-schedule">
          <div className="weekend-board">
            <div className="section-head row">
              <h2>{night.label}</h2>
              <span className="muted">
                {night.fixtures.length} match
                {night.fixtures.length === 1 ? "" : "es"}
                {night.fixtures.some((fixture) =>
                  ["adv", "ub", "ub_final", "lb", "lb_final", "final"].includes(
                    fixture.kind,
                  ),
                )
                  ? " · 10:00 AM–3:00 AM PKT"
                  : " · 10:00 PM–6:00 AM PKT"}
              </span>
            </div>
            <div className="weekend-grid schedule-grid">
              {night.fixtures.map((fixture) => {
                const winner = fixture.match?.winnerTeam?.name;
                const isNext = nextId === fixture.id;
                const bestOf = fixture.bestOf ?? 1;
                return (
                  <article
                    key={fixture.id}
                    className={
                      isNext ? "weekend-card weekend-card-next" : "weekend-card"
                    }
                  >
                    <div className="weekend-card-head">
                      <span className="weekend-day">
                        {isPlayoffKind(fixture.kind)
                          ? playoffRoundLabel(fixture.kind, fixture.slotKey)
                          : fixture.kind === "group"
                            ? "Group stage"
                            : formatScheduleWhen(fixture.scheduledAt)}
                      </span>
                      {winner && fixture.status === "completed" ? (
                        <span className="weekend-status weekend-status-won">
                          Done
                        </span>
                      ) : isNext ? (
                        <span className="weekend-status weekend-status-next">
                          Up next
                        </span>
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
                      <Link
                        className="weekend-team"
                        href={`/teams/${fixture.direTeam.id}`}
                      >
                        {fixture.direTeam.name}
                      </Link>
                    </p>
                    <p className="weekend-pkt">
                      {formatScheduleWhen(fixture.scheduledAt)}
                    </p>
                    {winner && fixture.status === "completed" ? (
                      <p className="weekend-result gold">{winner} won</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {night.fixtures.some((fixture) => fixture.id === nextId) &&
            upcoming[0] ? (
              <div className="weekend-times-panel">
                <p className="eyebrow">Kickoff times — next match</p>
                <MatchTimeZones at={upcoming[0].scheduledAt} />
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
