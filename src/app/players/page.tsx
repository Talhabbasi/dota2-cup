import { PlayersGrid, type PlayerCardView } from "@/components/players-grid";
import { getPlayers, formatRoles } from "@/lib/data";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "@/lib/play-window";
import { isRosterSub } from "@/lib/roles";
import { getCurrentSeasonSafe } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Players",
  "Registered MM Dota Cup players, medals, roles, and team assignments for the indoor Dota 2 tournament.",
);

export default async function PlayersPage() {
  const [players, season] = await Promise.all([getPlayers(), getCurrentSeasonSafe()]);

  const views: PlayerCardView[] = players.map((p) => ({
    id: p.id,
    steamName: p.steamName,
    medal: p.medal,
    rolesLabel: formatRoles(p.roles),
    roleKeys: p.roles,
    teamId: p.teamId,
    teamName: p.team?.name ?? null,
    isCaptain: p.isCaptain,
    isSub: isRosterSub(p.rosterRole),
    basePrice: p.basePrice,
    playWindowLabel: PLAY_WINDOW_SHORT[playWindowOrBoth(p.playWindow)],
    createdAt: p.createdAt.toISOString(),
  }));

  const unsigned = views.filter((p) => !p.teamId).length;
  const captains = views.filter((p) => p.isCaptain).length;

  return (
    <div className="page players-list-page">
      <header className="teams-list-hero players-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">
            {season ? `Season ${season.number}` : "Pool"}
          </p>
          <h1>Players</h1>
          {views.length > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{views.length}</strong> registered
              </span>
              <span className="teams-list-hero-pill">
                <strong>{unsigned}</strong> in auction pool
              </span>
              <span className="teams-list-hero-pill">
                <strong>{captains}</strong> captain{captains === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {views.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            👤
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No players registered.
          </p>
        </div>
      ) : (
        <PlayersGrid players={views} />
      )}
    </div>
  );
}
