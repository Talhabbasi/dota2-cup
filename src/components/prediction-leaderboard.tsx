import type { PredictionLeaderRow } from "@/lib/predictions";

export function PredictionLeaderboard({
  rows,
}: {
  rows: PredictionLeaderRow[];
  youRank?: number | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          No points yet.
        </p>
      </div>
    );
  }

  return (
    <div className="pred-points-board">
      <div className="pred-points-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Points</span>
      </div>
      <ol className="pred-points-list">
        {rows.map((row) => (
          <li
            key={row.playerId}
            className={
              row.isYou ? "pred-points-row pred-points-you" : "pred-points-row"
            }
          >
            <span
              className={`rank${row.rank <= 3 ? ` rank-${row.rank}` : ""}`}
              aria-label={`Rank ${row.rank}`}
            >
              {row.rank}
            </span>
            <span className="pred-points-name">
              {row.name}
              {row.isYou ? <span className="pred-you-tag">You</span> : null}
            </span>
            <strong className="pred-points-value">{row.points}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
