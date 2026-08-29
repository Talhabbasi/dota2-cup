import { PlayersGrid, type PlayerCardView } from "@/components/players-grid";
import { getPlayers, formatRoles } from "@/lib/data";
import { isRosterSub } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await getPlayers();

  const views: PlayerCardView[] = players.map((p) => ({
    id: p.id,
    steamName: p.steamName,
    discordName: p.discordName,
    medal: p.medal,
    rolesLabel: formatRoles(p.roles),
    roleKeys: p.roles,
    teamId: p.teamId,
    teamName: p.team?.name ?? null,
    isCaptain: p.isCaptain,
    isSub: isRosterSub(p.rosterRole),
    basePrice: p.basePrice,
  }));

  const unsigned = views.filter((p) => !p.teamId).length;
  const captains = views.filter((p) => p.isCaptain).length;

  return (
    <div className="page players-list-page">
      <header className="teams-list-hero players-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Pool</p>
          <h1>Players</h1>
          <p className="lede">
            Registered players for the auction. Open a profile for heroes, KDA,
            items, and match history.
          </p>
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
            Nobody registered yet. Use <code>/register</code> in Discord.
          </p>
        </div>
      ) : (
        <PlayersGrid players={views} />
      )}
    </div>
  );
}
