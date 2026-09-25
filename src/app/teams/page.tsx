import { PageHeader } from "@/components/common";
import {
  TeamsGrid,
  type FormDot,
  type TeamCardView,
} from "@/components/teams-grid";
import { getStandings, getTeams } from "@/lib/data";
import { isRosterSub } from "@/lib/roles";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Teams & Rosters",
  `Meet the eight ${CUP_NAME} franchises, captains, and rosters for this indoor Dota 2 season in Pakistan.`,
);

/** Approximate recent form from W/L totals when match history isn't on the list. */
function formFromRecord(wins: number, losses: number): FormDot[] {
  const slots: FormDot[] = [];
  const total = wins + losses;
  if (total === 0) {
    return ["·", "·", "·", "·", "·"];
  }
  for (let i = 0; i < wins && slots.length < 5; i++) slots.push("W");
  for (let i = 0; i < losses && slots.length < 5; i++) slots.push("L");
  while (slots.length < 5) slots.push("·");
  return slots;
}

export default async function TeamsPage() {
  const [teams, table] = await Promise.all([getTeams(), getStandings()]);
  const rankById = new Map(table.map((row, i) => [row.id, i + 1]));
  const recordById = new Map(table.map((row) => [row.id, row]));

  const cards: TeamCardView[] = teams.map((team) => {
    const captain = team.players.find((p) => p.isCaptain);
    const starters = team.players.filter((p) => !isRosterSub(p.rosterRole));
    const subs = team.players.filter((p) => isRosterSub(p.rosterRole));
    const record = recordById.get(team.id);
    const wins = record?.wins ?? 0;
    const losses = record?.losses ?? 0;

    return {
      id: team.id,
      name: team.name,
      captainName: captain?.steamName ?? null,
      playerCount: team.players.length,
      starterCount: starters.length,
      subCount: subs.length,
      wins,
      losses,
      rank: rankById.get(team.id) ?? 0,
      playerNames: team.players.map((p) => p.steamName),
      form: formFromRecord(wins, losses),
    };
  });

  return (
    <div className="page teams-list-page">
      <PageHeader
        eyebrow="Franchises"
        title="Teams"
        pills={
          cards.length > 0
            ? [
                { value: cards.length, label: "active franchises" },
                {
                  value: cards.reduce((n, t) => n + t.playerCount, 0),
                  label: "players signed",
                },
              ]
            : undefined
        }
      />

      {cards.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🏆
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No teams yet.
          </p>
        </div>
      ) : (
        <TeamsGrid teams={cards} />
      )}
    </div>
  );
}
