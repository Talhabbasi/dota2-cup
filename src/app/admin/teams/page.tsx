import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listRegisteredPlayers } from "@/lib/players-admin";
import { pageMeta } from "@/lib/seo";
import { AdminTeamsBoard } from "@/components/admin/teams-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Teams", "Captains and franchise names.");

export default async function AdminTeamsPage() {
  await requireAdmin();
  const [teams, players] = await Promise.all([
    adminListTeamsForPicker(),
    listRegisteredPlayers(),
  ]);
  const unsigned = players
    .filter((p) => !p.teamId && !p.isCaptain)
    .map((p) => ({ discordId: p.discordId, steamName: p.steamName }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Teams"
        subtitle="Click a franchise to open its admin page."
        pills={[
          { value: teams.length, label: "franchises" },
          { value: unsigned.length, label: "unsigned" },
        ]}
      />
      <AdminTeamsBoard
        teams={teams.map((team) => {
          const captain =
            team.players.find((p) => p.id === team.captainId) ??
            team.players.find((p) => p.isCaptain);
          return {
            id: team.id,
            name: team.name,
            purse: team.purse,
            captainName: captain?.steamName ?? null,
            playerCount: team.players.length,
          };
        })}
        unsigned={unsigned}
        allPlayers={players.map((p) => ({
          discordId: p.discordId,
          steamName: p.steamName,
          teamName: p.team?.name ?? null,
        }))}
      />
    </div>
  );
}
