import { HeroesGrid } from "@/components/heroes-grid";
import { getHeroTournamentStats } from "@/lib/heroes";

export const dynamic = "force-dynamic";

export default async function HeroesPage() {
  const heroes = await getHeroTournamentStats();
  const played = heroes.filter((h) => h.plays > 0).length;
  const totalPicks = heroes.reduce((n, h) => n + h.plays, 0);

  return (
    <div className="page heroes-list-page">
      <header className="teams-list-hero heroes-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Pool</p>
          <h1>Heroes</h1>
          <p className="lede">
            Every Dota hero — open one to see cup matches, players, and stats.
          </p>
          <div className="teams-list-hero-pills">
            <span className="teams-list-hero-pill">
              <strong>{played}</strong> / {heroes.length} picked
            </span>
            {totalPicks > 0 ? (
              <span className="teams-list-hero-pill">
                <strong>{totalPicks}</strong> hero picks in matches
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <HeroesGrid heroes={heroes} />
    </div>
  );
}
