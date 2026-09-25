import { EsportsCard, PageHeader, StatTile } from "@/components/common";
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
  "Pick MM Dota Cup winners. Group stage and The International lock Friday at 10:00 PM PKT. One combined points board.",
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
  const you = board.rows.find((row) => row.isYou) ?? null;
  const accuracy =
    you && you.picks > 0
      ? Math.round((you.correct / you.picks) * 100)
      : null;

  return (
    <div className="page pred-page">
      <PageHeader
        eyebrow="Pick’em"
        title="Predictions"
        subtitle={`Group stage and The International lock Friday at 10:00 PM PKT. Group picks are ${PREDICTION_POINTS} points each. The International is a Dota 2 Pick’em tree — tap a winner to send them forward. Grand Final is ${FINAL_PREDICTION_POINTS} points.`}
        pills={[
          ...(season ? [{ label: `Season ${season.number}` }] : []),
          {
            value: stages.group.stageLocked
              ? "Locked"
              : stages.group.openCount,
            label: stages.group.stageLocked ? "groups" : "group open",
          },
          {
            value: pickem.unlocked
              ? pickem.treeLocked
                ? "Locked"
                : "Open"
              : "Locked",
            label: "International",
          },
          {
            value: board.playerCount,
            label: board.revealed ? "on the board" : "predicted",
          },
        ]}
      />

      {you ? (
        <EsportsCard interactive={false} className="mb-6 p-5">
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Your standings
          </p>
          <ul className="mt-4 mb-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
            <li>
              <StatTile label="Rank" value={`#${you.rank}`} />
            </li>
            <li>
              <StatTile label="Points" value={you.points} />
            </li>
            <li>
              <StatTile label="Correct" value={`${you.correct}/${you.picks}`} />
            </li>
            <li>
              <StatTile
                label="Accuracy"
                value={accuracy != null ? `${accuracy}%` : "—"}
              />
            </li>
          </ul>
        </EsportsCard>
      ) : canPick ? (
        <EsportsCard interactive={false} className="mb-6 p-5">
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Your standings
          </p>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            Points and accuracy unlock here when every group-stage match is
            scored. Keep picking — your votes are saved.
          </p>
        </EsportsCard>
      ) : (
        <EsportsCard interactive={false} className="mb-6 p-5">
          <p className="m-0 text-sm text-muted-foreground">
            Sign in with Discord to lock in winners and climb the points board.
          </p>
        </EsportsCard>
      )}

      <EsportsCard interactive={false} className="mb-6 overflow-hidden p-0">
        <div className="border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 className="m-0 font-display text-lg">Make your picks</h2>
        </div>
        <div className="p-4 sm:p-5">
          <PredictionStageTabs
            group={stages.group}
            pickem={pickem}
            canPick={canPick}
          />
        </div>
      </EsportsCard>

      <section className="pred-section">
        {board.revealed ? (
          <EsportsCard interactive={false} className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <h2 className="m-0 font-display text-lg">Points board</h2>
              <span className="text-sm text-muted-foreground">
                Ranked by points
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <PredictionLeaderboard rows={board.rows} />
            </div>
          </EsportsCard>
        ) : (
          <>
            <div className="section-head row">
              <h2>Predictions in</h2>
              <span className="muted">Names and points after group stage</span>
            </div>
            <EsportsCard interactive={false} className="p-6 text-center">
              <p className="m-0 font-mono text-4xl font-bold tabular-nums text-primary">
                {board.playerCount}
              </p>
              <p className="mt-2 mb-0 text-foreground">
                {board.playerCount === 1
                  ? "player has predicted"
                  : "players have predicted"}
              </p>
              <p className="mt-2 mb-0 text-sm text-muted-foreground">
                Names and scores open on this board when every group-stage
                match is done.
              </p>
            </EsportsCard>
          </>
        )}
      </section>
    </div>
  );
}
