import Link from "next/link";
import type { PredictionLeaderRow } from "@/lib/predictions";

export function PredictionLeaderboard({
  rows,
  youRank,
}: {
  rows: PredictionLeaderRow[];
  youRank: number | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          No picks yet. The board fills as registered players lock in winners.
        </p>
      </div>
    );
  }

  return (
    <div className="pred-chart">
      {youRank ? (
        <p className="pred-chart-you muted">
          You are <strong>#{youRank}</strong> of {rows.length}
        </p>
      ) : null}
      <ol className="pred-chart-list">
        {rows.map((row) => (
          <li
            key={row.playerId}
            className={row.isYou ? "pred-chart-row pred-chart-you-row" : "pred-chart-row"}
          >
            <span className="pred-chart-rank">{row.rank}</span>
            <div className="pred-chart-body">
              <div className="pred-chart-meta">
                <Link href={`/players/${row.playerId}`} className="pred-chart-name">
                  {row.name}
                  {row.isYou ? <span className="pred-you-tag">You</span> : null}
                </Link>
                <span className="pred-chart-pts">
                  <strong>{row.points}</strong> pts
                </span>
              </div>
              <div
                className="pred-chart-track"
                aria-hidden
              >
                <span
                  className="pred-chart-fill"
                  style={{ width: `${Math.max(row.barPct, row.points > 0 ? 6 : 0)}%` }}
                />
              </div>
              <p className="pred-chart-sub muted">
                {row.correct} correct · {row.picks} pick
                {row.picks === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
