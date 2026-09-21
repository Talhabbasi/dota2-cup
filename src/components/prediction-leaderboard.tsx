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
    <ol className="pred-points-list">
      {rows.map((row) => (
        <li
          key={row.playerId}
          className={row.isYou ? "pred-points-row pred-points-you" : "pred-points-row"}
        >
          <span className="pred-points-name">
            {row.name}
            {row.isYou ? <span className="pred-you-tag">You</span> : null}
          </span>
          <span className="pred-points-arrow" aria-hidden>
            →
          </span>
          <strong className="pred-points-value">{row.points}</strong>
        </li>
      ))}
    </ol>
  );
}
