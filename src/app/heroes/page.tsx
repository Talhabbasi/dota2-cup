import { PageHeader, StatTile } from "@/components/common";
import { HeroesGrid } from "@/components/heroes-grid";
import { getHeroTournamentStats } from "@/lib/heroes";
import { getLiveSeason } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import Link from "next/link";

export const revalidate = 30;

export const metadata = pageMeta(
  "Dota 2 Heroes",
  `See which Dota 2 heroes are picked in ${CUP_NAME} matches, with tournament pick counts and results.`,
);

export default async function HeroesPage() {
  const live = await getLiveSeason();
  if (!live) {
    return (
      <div className="page heroes-list-page">
        <PageHeader
          className="heroes-list-hero"
          eyebrow="Pool"
          title="Heroes"
          subtitle="Hero pick stats appear when a season is live."
        />
        <p className="m-0 text-sm text-muted-foreground">
          No live tournament right now. Browse the{" "}
          <Link href="/seasons" className="text-link">
            season archive
          </Link>{" "}
          for past cups.
        </p>
      </div>
    );
  }

  const heroes = await getHeroTournamentStats();
  const played = heroes.filter((h) => h.plays > 0);
  const unpicked = heroes.length - played.length;
  const totalPicks = heroes.reduce((n, h) => n + h.plays, 0);
  const hasPicks = totalPicks > 0;
  const mostPicked =
    played.length > 0
      ? [...played].sort(
          (a, b) => b.plays - a.plays || a.name.localeCompare(b.name),
        )[0]
      : null;

  return (
    <div className="page heroes-list-page">
      <PageHeader
        className="heroes-list-hero"
        eyebrow="Pool"
        title="Heroes"
        subtitle={
          hasPicks
            ? `Pick rates from ${live.name} matches.`
            : `${live.name} is live — pick rates appear once scoreboards are logged.`
        }
        pills={[
          hasPicks
            ? {
                value: (
                  <>
                    {played.length} / {heroes.length}
                  </>
                ),
                label: "picked",
              }
            : {
                value: heroes.length,
                label: "in the pool",
              },
          ...(hasPicks
            ? [{ value: totalPicks, label: "hero picks in matches" }]
            : [{ value: live.name, label: "season" }]),
        ]}
      />

      {hasPicks ? (
        <ul className="mb-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
          <li>
            <StatTile
              label="Most picked"
              value={mostPicked ? mostPicked.name : "—"}
            />
          </li>
          <li>
            <StatTile label="Unpicked in cup" value={String(unpicked)} />
          </li>
          <li>
            <StatTile label="Season" value={live.name} />
          </li>
        </ul>
      ) : (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          No cup matches with hero picks yet. Browse the pool below — counts
          fill in after organizers log scoreboards.
        </div>
      )}

      <HeroesGrid heroes={heroes} />
    </div>
  );
}
