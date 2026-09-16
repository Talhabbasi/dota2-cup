import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonHistory } from "@/lib/seasons";

export const revalidate = 30;

function statusLabel(status: string, live: boolean) {
  if (live) return "Live";
  if (status === "archived") return "Champion";
  if (status === "upcoming") return "Upcoming";
  return status;
}

export default async function SeasonsPage() {
  const history = await getSeasonHistory();
  const seasons = history.filter((row) => row.champion);
  if (seasons.length === 0) notFound();

  return (
    <div className="page seasons-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Archive</p>
          <h1>Seasons</h1>
          <div className="teams-list-hero-pills">
            <span className="teams-list-hero-pill">
              <strong>{seasons.length}</strong> season
              {seasons.length === 1 ? "" : "s"}
            </span>
            <span className="teams-list-hero-pill">
              <strong>{seasons.length}</strong> champion
              {seasons.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </header>

      {seasons.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🏆
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No seasons yet.
          </p>
        </div>
      ) : (
        <div className="season-history-stack">
          {seasons.map((season) => {
            const starters =
              season.champion?.players.filter((player) => !player.isSub) ?? [];
            const subs =
              season.champion?.players.filter((player) => player.isSub) ?? [];
            return (
              <article key={season.id} className="season-history-card">
                <header>
                  <p className="eyebrow">
                    {statusLabel(season.status, season.live)}
                    {season.live ? (
                      <span className="badge badge-gold">Now</span>
                    ) : null}
                  </p>
                  <h2>
                    Season {season.number}
                    {season.name !== `Season ${season.number}`
                      ? ` · ${season.name}`
                      : ""}
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
                ) : (
                  <p className="muted">
                    {season.live
                      ? "Grand Final not played yet. The champion will show here after the Bo3."
                      : "No champion recorded for this season."}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
