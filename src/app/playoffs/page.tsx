import { PlayoffBracket } from "@/components/playoff-bracket";
import { getPlayoffView } from "@/lib/playoff";

export const revalidate = 30;

export default async function PlayoffsPage() {
  const view = await getPlayoffView();

  return (
    <div className="page playoffs-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Tournament</p>
          <h1>Playoffs</h1>
          <p className="lede">
            8 teams in 2 groups of 4. Group matches will be posted when the
            schedule is ready.
          </p>
          <div className="teams-list-hero-pills">
            <span className="teams-list-hero-pill">
              <strong>Group A</strong> {view.groupA.length} teams
            </span>
            <span className="teams-list-hero-pill">
              <strong>Group B</strong> {view.groupB.length} teams
            </span>
          </div>
        </div>
      </header>

      <PlayoffBracket view={view} />
    </div>
  );
}
