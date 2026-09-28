import Link from "next/link";
import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { pageMeta } from "@/lib/seo";
import { getSeasonByIdOrNumber, getSeasonHistory } from "@/lib/seasons";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Season Archive",
  `Past ${CUP_NAME} seasons and champions from this indoor Dota 2 tournament in Pakistan.`,
);

function statusLabel(status: string, live: boolean, hasChampion: boolean) {
  if (hasChampion && status === "archived") return "Champions";
  if (live) return "Live";
  if (status === "archived") return "Archived";
  if (status === "upcoming") return "Upcoming";
  return status;
}

export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonParam = params.season?.trim() || null;
  const [seasons, focused] = await Promise.all([
    getSeasonHistory(),
    seasonParam ? getSeasonByIdOrNumber(seasonParam) : Promise.resolve(null),
  ]);

  const focusSeason =
    focused ??
    (seasonParam
      ? seasons.find(
          (s) =>
            String(s.number) === seasonParam || s.id === seasonParam,
        ) ?? null
      : null);

  const focusId =
    focused?.id ??
    (focusSeason && "id" in focusSeason ? focusSeason.id : null);

  const insights = focusId
    ? await getPublicPlayerInsight({ seasonId: focusId })
    : null;

  const insightsHasAny =
    Boolean(insights?.playerOfTournament) ||
    Boolean(insights?.mostKills) ||
    Boolean(insights?.mostAssists) ||
    Boolean(insights?.highestBid);

  const focusHistory = focusId
    ? seasons.find((s) => s.id === focusId) ?? null
    : null;

  return (
    <div className="page seasons-page">
      <PageHeader
        eyebrow="Archive"
        title={
          focusHistory
            ? `Season ${focusHistory.number}`
            : "Seasons"
        }
        subtitle={
          focusHistory
            ? `${focusHistory.name} summary — champion, roster, and player insight awards.`
            : "Completed seasons stay read-only — open a season for champion, bracket, and insight highlights."
        }
        pills={[
          focusHistory
            ? {
                value: statusLabel(
                  focusHistory.status,
                  focusHistory.live,
                  Boolean(focusHistory.champion),
                ),
                label: "status",
              }
            : {
                value: seasons.length,
                label: `season${seasons.length === 1 ? "" : "s"}`,
              },
        ]}
      />

      {focusHistory ? (
        <section className="mb-8" aria-label={`Season ${focusHistory.number} summary`}>
          <article className="season-history-card">
            <header>
              <p className="eyebrow">
                {statusLabel(
                  focusHistory.status,
                  focusHistory.live,
                  Boolean(focusHistory.champion),
                )}
                {focusHistory.live ? (
                  <span className="badge badge-gold">Now</span>
                ) : null}
              </p>
              <h2>
                Season {focusHistory.number}
                {focusHistory.name !== `Season ${focusHistory.number}`
                  ? ` · ${focusHistory.name}`
                  : ""}
              </h2>
            </header>

            {focusHistory.champion ? (
              <>
                <p className="season-history-winner">
                  Champion{" "}
                  <Link href={`/teams/${focusHistory.champion.id}`}>
                    {focusHistory.champion.name}
                  </Link>
                </p>
                <p className="m-0 mb-3 flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/playoffs?season=${focusHistory.number}`}
                    className="text-link"
                  >
                    View bracket
                  </Link>
                  <Link
                    href={`/matches?season=${focusHistory.number}`}
                    className="text-link"
                  >
                    All matches
                  </Link>
                  <Link
                    href={`/player-insight?season=${focusHistory.number}`}
                    className="text-link"
                  >
                    Full player insight
                  </Link>
                </p>
                {(() => {
                  const starters =
                    focusHistory.champion.players.filter((p) => !p.isSub) ?? [];
                  const subs =
                    focusHistory.champion.players.filter((p) => p.isSub) ?? [];
                  return (
                    <>
                      {starters.length > 0 ? (
                        <ul className="season-history-roster">
                          {starters.map((player) => (
                            <li key={player.id}>
                              <Link href={`/players/${player.id}`}>
                                {player.steamName}
                                {player.isCaptain ? " (C)" : ""}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Roster was not saved for this team.</p>
                      )}
                      {subs.length > 0 ? (
                        <p className="muted season-history-subs">
                          Subs{" "}
                          {subs.map((player, index) => (
                            <span key={player.id}>
                              {index > 0 ? " · " : ""}
                              <Link href={`/players/${player.id}`}>
                                {player.steamName}
                              </Link>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="muted">
                {focusHistory.live
                  ? "Grand Final not played yet. The champion will show here after the Bo3."
                  : focusHistory.status === "upcoming"
                    ? "Upcoming — not started yet."
                    : "No champion recorded for this season."}
              </p>
            )}
          </article>

          <div className="mt-8">
            <div className="section-head">
              <h2>Player insight</h2>
              <p className="m-0 text-sm text-muted-foreground">
                Season {focusHistory.number} awards — kills, assists, auction, predictions,
                and player of the tournament.
              </p>
            </div>
            {insights && insightsHasAny ? (
              <PlayerInsightAwardsGrid awards={insights} />
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                No scoreboard or auction highlights stored for this season yet.
              </p>
            )}
          </div>

          <p className="mt-6 mb-0">
            <Link href="/seasons" className="text-link">
              ← All seasons
            </Link>
          </p>
        </section>
      ) : null}

      {(!focusHistory || seasons.length > 1) && (
        <div className={focusHistory ? "mt-4" : undefined}>
          {focusHistory ? (
            <div className="section-head">
              <h2>All seasons</h2>
            </div>
          ) : null}
          {seasons.length === 0 ? (
            <div className="empty-panel teams-list-empty">
              <p className="muted" style={{ margin: 0 }}>
                No seasons yet.
              </p>
            </div>
          ) : (
            <div className="season-history-stack">
              {seasons.map((season) => {
                const starters =
                  season.champion?.players.filter((player) => !player.isSub) ??
                  [];
                const subs =
                  season.champion?.players.filter((player) => player.isSub) ??
                  [];
                const isFocus = focusId === season.id;
                return (
                  <article
                    key={season.id}
                    className="season-history-card"
                    style={isFocus ? { outline: "1px solid rgba(245,158,11,0.35)" } : undefined}
                  >
                    <header>
                      <p className="eyebrow">
                        {statusLabel(
                          season.status,
                          season.live,
                          Boolean(season.champion),
                        )}
                        {season.live ? (
                          <span className="badge badge-gold">Now</span>
                        ) : null}
                        {season.champion && season.status === "archived" ? (
                          <span className="badge badge-gold">Complete</span>
                        ) : null}
                      </p>
                      <h2>
                        <Link href={`/seasons?season=${season.number}`}>
                          Season {season.number}
                          {season.name !== `Season ${season.number}`
                            ? ` · ${season.name}`
                            : ""}
                        </Link>
                      </h2>
                    </header>

                    {season.champion ? (
                      <>
                        <p className="season-history-winner">
                          Champion{" "}
                          <Link href={`/teams/${season.champion.id}`}>
                            {season.champion.name}
                          </Link>
                        </p>
                        <p className="m-0 mb-3 flex flex-wrap gap-3 text-sm">
                          <Link
                            href={`/seasons?season=${season.number}`}
                            className="text-link"
                          >
                            Season summary
                          </Link>
                          <Link
                            href={`/playoffs?season=${season.number}`}
                            className="text-link"
                          >
                            View bracket
                          </Link>
                          <Link
                            href={`/matches?season=${season.number}`}
                            className="text-link"
                          >
                            All matches
                          </Link>
                        </p>
                        {starters.length > 0 ? (
                          <ul className="season-history-roster">
                            {starters.map((player) => (
                              <li key={player.id}>
                                <Link href={`/players/${player.id}`}>
                                  {player.steamName}
                                  {player.isCaptain ? " (C)" : ""}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">
                            Roster was not saved for this team.
                          </p>
                        )}
                        {subs.length > 0 ? (
                          <p className="muted season-history-subs">
                            Subs{" "}
                            {subs.map((player, index) => (
                              <span key={player.id}>
                                {index > 0 ? " · " : ""}
                                <Link href={`/players/${player.id}`}>
                                  {player.steamName}
                                </Link>
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="muted">
                        {season.live
                          ? "Grand Final not played yet. The champion will show here after the Bo3."
                          : season.status === "upcoming"
                            ? "Upcoming — not started yet."
                            : "No champion recorded for this season."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
