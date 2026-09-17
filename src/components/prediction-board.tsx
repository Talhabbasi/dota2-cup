"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  lockLabel,
  emptyText,
  lockedNote,
  openHint,
}: {
  nights: PredictionNightView[];
  canPick: boolean;
  stageLocked: boolean;
  lockLabel: string | null;
  emptyText: string;
  lockedNote: string;
  openHint: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(fixtureId: string, teamId: string) {
    if (!canPick || busyId) return;
    setBusyId(fixtureId);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId, teamId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save that pick.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save that pick.");
    } finally {
      setBusyId(null);
    }
  }

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
      {error ? <p className="pred-error">{error}</p> : null}
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
                        const selected = fixture.myPickId === team.id;
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
                            disabled={
                              !canPick ||
                              fixture.locked ||
                              busyId === fixture.id
                            }
                            onClick={() => pick(fixture.id, team.id)}
                          >
                            {team.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="pred-card-note">
                      {fixture.completed
                        ? fixture.myPickId
                          ? fixture.myPickId === fixture.winnerTeamId
                            ? `Correct · +${fixture.points}`
                            : "Missed"
                          : "No pick"
                        : stageLocked
                          ? fixture.myPickId
                            ? "Locked in"
                            : lockedNote
                          : canPick
                            ? openHint ||
                              (lockLabel
                                ? `Tap a team before ${lockLabel}`
                                : "Tap a team")
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
