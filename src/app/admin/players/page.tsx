import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { MEDALS, MEDAL_LABELS, ROLE_LABELS } from "@/lib/constants";
import { listRegisteredPlayers } from "@/lib/players-admin";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { PLAY_WINDOW_LABELS } from "@/lib/play-window";
import { pageMeta } from "@/lib/seo";
import { AdminPlayersBoard } from "@/components/admin/players-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Players", "Register and manage players.");

export default async function AdminPlayersPage() {
  await requireAdmin();
  const [players, teams] = await Promise.all([
    listRegisteredPlayers(),
    adminListTeamsForPicker(),
  ]);

  const medalOptions = MEDALS.map((m) => ({
    value: m,
    label: MEDAL_LABELS[m],
  }));
  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const windowOptions = Object.entries(PLAY_WINDOW_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Players"
        subtitle="Click a player to open their full admin page."
        pills={[
          { value: players.length, label: "registered" },
          {
            value: players.filter((p) => !p.teamId).length,
            label: "unsigned",
          },
        ]}
      />
      <AdminPlayersBoard
        players={players.map((p) => ({
          id: p.id,
          discordId: p.discordId,
          steamName: p.steamName,
          medal: p.medal,
          medalLabel:
            MEDAL_LABELS[p.medal as keyof typeof MEDAL_LABELS] ?? p.medal,
          teamName: p.team?.name ?? null,
          isCaptain: p.isCaptain,
          rosterRole: p.rosterRole,
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        medalOptions={medalOptions}
        roleOptions={roleOptions}
        windowOptions={windowOptions}
      />
    </div>
  );
}
