import { PageHeader, StatTile } from "@/components/common";
import { HeroesGrid } from "@/components/heroes-grid";
import { getHeroTournamentStats } from "@/lib/heroes";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Dota 2 Heroes",
  `See which Dota 2 heroes are picked in ${CUP_NAME} matches, with tournament pick counts and results.`,
);

export default async function HeroesPage() {
  const heroes = await getHeroTournamentStats();
  const played = heroes.filter((h) => h.plays > 0);
  const unpicked = heroes.length - played.length;
  const totalPicks = heroes.reduce((n, h) => n + h.plays, 0);
  const mostPicked =
    played.length > 0
      ? [...played].sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))[0]
      : null;

  return (
    <div className="page heroes-list-page">
      <PageHeader
        className="heroes-list-hero"
        eyebrow="Pool"
        title="Heroes"
        pills={[
          {
            value: (
              <>
                {played.length} / {heroes.length}
              </>
            ),
            label: "picked",
          },
          ...(totalPicks > 0
            ? [{ value: totalPicks, label: "hero picks in matches" }]
            : []),
        ]}
      />

      <ul className="mb-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
        <li>
          <StatTile
            label="Most picked"
            value={mostPicked ? mostPicked.name : "—"}
          />
        </li>
        <li>
          <StatTile label="Total picks" value={totalPicks} />
        </li>
        <li>
          <StatTile label="Unpicked" value={unpicked} />
        </li>
      </ul>

      <HeroesGrid heroes={heroes} />
    </div>
  );
}
