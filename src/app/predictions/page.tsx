import { currentPlayer } from "@/lib/auth";
import { PredictionLeaderboard } from "@/components/prediction-leaderboard";
import { PredictionStageTabs } from "@/components/prediction-stage-tabs";
import {
  FINAL_PREDICTION_POINTS,
  PREDICTION_POINTS,
  getInternationalPickem,
  getPredictionBoard,
  getPredictionLeaderboard,
} from "@/lib/predictions";
import { getCurrentSeasonSafe } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Match Predictions",
  "Pick MM Dota Cup winners. Group stage locks Saturday at 10:45 PM PKT. The International unlocks after every group match. One combined points board.",
);

export default async function PredictionsPage() {
  const [{ player }, season] = await Promise.all([
    currentPlayer(),
    getCurrentSeasonSafe(),
  ]);
  const [stages, board, pickem] = await Promise.all([
    getPredictionBoard(player?.id),
    getPredictionLeaderboard(player?.id),
    getInternationalPickem(player?.id),
  ]);
  const canPick = Boolean(player);

  return (
    <div className="page pred-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Pick’em</p>
          <h1>Predictions</h1>
          <p className="muted auction-hero-copy">
            Group stage: {PREDICTION_POINTS} points per correct pick, locked
            Saturday at 10:45 PM PKT. The International is a fill-in bracket —
            pick the opening upper and lower matches, then send winners and
            losers through the tree. Grand Final is {FINAL_PREDICTION_POINTS}{" "}
            points. The points board is name → points.
          </p>
          <div className="teams-list-hero-pills">
            {season ? (
              <span className="teams-list-hero-pill">
                <strong>Season {season.number}</strong>
              </span>
            ) : null}
            <span className="teams-list-hero-pill">
              {stages.group.stageLocked ? (
                <>
                  <strong>Locked</strong> groups
                </>
              ) : (
                <>
                  <strong>{stages.group.openCount}</strong> group open
                </>
              )}
            </span>
            <span className="teams-list-hero-pill">
              {pickem.unlocked ? (
                pickem.treeLocked ? (
                  <>
                    <strong>Locked</strong> International
                  </>
                ) : (
                  <>
                    <strong>Open</strong> International
                  </>
                )
              ) : (
                <>
                  <strong>Locked</strong> International
                </>
              )}
            </span>
            <span className="teams-list-hero-pill">
              {board.revealed ? (
                <>
                  <strong>{board.playerCount}</strong> on the board
                </>
              ) : (
                <>
                  <strong>{board.playerCount}</strong> predicted
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <PredictionStageTabs
        group={stages.group}
        pickem={pickem}
        canPick={canPick}
      />

      <section className="pred-section">
        {board.revealed ? (
          <>
            <div className="section-head row">
              <h2>Points board</h2>
              <span className="muted">name → points</span>
            </div>
            <PredictionLeaderboard rows={board.rows} />
          </>
        ) : (
          <>
            <div className="section-head row">
              <h2>Predictions in</h2>
              <span className="muted">
                Names and points after group stage
              </span>
            </div>
            <div className="empty-panel teams-list-empty pred-count-panel">
              <p className="pred-count-num">{board.playerCount}</p>
              <p style={{ margin: 0 }}>
                {board.playerCount === 1
                  ? "player has predicted"
                  : "players have predicted"}
              </p>
              <p className="muted" style={{ margin: "0.55rem 0 0" }}>
                The points board with names opens when every group-stage match
                is done.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
