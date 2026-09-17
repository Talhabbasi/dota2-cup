import type { PredictionNightView } from "@/lib/predictions";

function pickResult(
  fixture: PredictionNightView["fixtures"][number],
  teamId: string,
) {
  if (!fixture.completed || !fixture.winnerTeamId) return null;
  if (fixture.winnerTeamId === teamId) return "win";
  return "loss";
}

export function PredictionBoard({
  nights,
  canPick,
  stageLocked,
  emptyText,
  lockedNote,
  openHint,
  pickId,
  saving,
  onPick,
}: {
  nights: PredictionNightView[];
  canPick: boolean;
  stageLocked: boolean;
  emptyText: string;
  lockedNote: string;
  openHint: string;
  pickId: (fixtureId: string, savedPickId: string | null) => string | null;
  saving: boolean;
  onPick: (fixtureId: string, teamId: string, savedPickId: string | null) => void;
}) {
  if (nights.length === 0) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className="pred-board">
      {nights.map((night) => (
        <section key={night.label} className="weekend-schedule">
          <div className="weekend-board">
            <div className="section-head row">
              <h2>{night.label}</h2>
              <span className="muted">
                {night.fixtures.length} series
                {night.fixtures.some((row) => row.points === 50)
                  ? " · Grand Final 50 pts"
                  : " · 10 pts each"}
              </span>
            </div>
            <div className="weekend-grid schedule-grid pred-grid">
              {night.fixtures.map((fixture) => {
                const series =
                  fixture.bestOf > 1
                    ? `BO${fixture.bestOf} ${fixture.radiantWins}–${fixture.direWins}`
                    : "BO1";
                const selectedId = pickId(fixture.id, fixture.myPickId);
                return (
                  <article key={fixture.id} className="weekend-card pred-card">
                    <div className="weekend-card-head">
                      <span className="weekend-day">{fixture.roundLabel}</span>
                      <span
                        className={
                          fixture.completed
                            ? "weekend-status weekend-status-won"
                            : fixture.locked
                              ? "weekend-status"
                              : "weekend-status weekend-status-next"
                        }
                      >
                        {fixture.completed
                          ? "Done"
                          : fixture.locked
                            ? "Locked"
                            : `${fixture.points} pts`}
                      </span>
                    </div>
                    <p className="weekend-pkt">
                      {fixture.whenLabel} · {series}
                    </p>
                    <div className="pred-picks">
                      {[fixture.radiant, fixture.dire].map((team) => {
                        const selected = selectedId === team.id;
                        const result = pickResult(fixture, team.id);
                        const wonSeries = fixture.winnerTeamId === team.id;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            className={[
                              "pred-pick",
                              selected ? "pred-pick-on" : "",
                              result === "win" ? "pred-pick-correct" : "",
                              result === "loss" && selected
                                ? "pred-pick-miss"
                                : "",
                              wonSeries && fixture.completed
                                ? "pred-pick-winner"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            disabled={!canPick || fixture.locked || saving}
                            onClick={() =>
                              onPick(fixture.id, team.id, fixture.myPickId)
                            }
                          >
                            {team.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="pred-card-note">
                      {fixture.completed
                        ? selectedId
                          ? selectedId === fixture.winnerTeamId
                            ? `Correct · +${fixture.points}`
                            : "Missed"
                          : "No pick"
                        : stageLocked
                          ? selectedId
                            ? "Locked in"
                            : lockedNote
                          : canPick
                            ? selectedId
                              ? "Picked · save when you are done"
                              : openHint
                            : ""}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
