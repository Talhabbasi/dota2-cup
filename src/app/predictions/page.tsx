import { EsportsCard, PageHeader, StatTile } from "@/components/common";
import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { PredictionLeaderboard } from "@/components/prediction-leaderboard";
import { PredictionStageTabs } from "@/components/prediction-stage-tabs";
import { getCupFeatureSettings } from "@/lib/cup-features";
import {
  FINAL_PREDICTION_POINTS,
  PREDICTION_POINTS,
  getInternationalPickem,
  getPredictionBoard,
  getPredictionLeaderboard,
} from "@/lib/predictions";
import { getCurrentSeasonSafe } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Match Predictions",
  `Pick ${CUP_NAME} winners. Group stage and The International lock Friday at 10:00 PM PKT. One combined points board.`,
);

export default async function PredictionsPage() {
  const [{ session, player }, season, features] = await Promise.all([
    currentPlayer(),
    getCurrentSeasonSafe(),
    getCupFeatureSettings(),
  ]);
  const [stages, board, pickem] = await Promise.all([
    getPredictionBoard(player?.id),
    getPredictionLeaderboard(player?.id),
    getInternationalPickem(player?.id),
  ]);
  const picksUnlocked = features.predictionsEnabled;
  const canPick = Boolean(player) && picksUnlocked;
  const signedIn = Boolean(session?.user?.discordId);
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
            value: picksUnlocked ? "Open" : "Locked",
            label: "organizer",
          },
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

      {!picksUnlocked ? (
        <EsportsCard interactive={false} className="mb-6 border-amber-500/30 p-5">
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-amber-300 uppercase">
            Picks locked
          </p>
          <p className="mt-2 mb-0 text-sm text-muted-foreground">
            An organizer locked predictions. You can still view the board; new
            picks and edits are blocked until they unlock again.
          </p>
        </EsportsCard>
      ) : null}
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
      ) : player ? null : signedIn ? (
        <EsportsCard interactive={false} className="mb-6 p-5">
          <p className="m-0 text-sm text-muted-foreground">
            You are signed in, but not registered for this cup yet.{" "}
            <Link href="/register" className="text-link">
              Register
            </Link>{" "}
            to lock in winners and climb the points board.
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
