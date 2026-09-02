import Link from "next/link";
import { PlayersGrid, type PlayerCardView } from "@/components/players-grid";
import { getPlayers, formatRoles } from "@/lib/data";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "@/lib/play-window";
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
    playWindowLabel: PLAY_WINDOW_SHORT[playWindowOrBoth(p.playWindow)],
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
            Registered players for the auction. Each card shows weekend
            availability: 8pm–12am, after 12am, or either.
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
            Nobody registered yet. Use <Link href="/register">Register</Link> on
            this site, or <code>/register</code> in Discord #register.
          </p>
        </div>
      ) : (
        <PlayersGrid players={views} />
      )}
    </div>
  );
}
