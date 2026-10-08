import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listPlayersForAdminSeason } from "@/lib/players-admin";
import { pageMeta } from "@/lib/seo";
import { AdminTeamsBoard } from "@/components/admin/teams-board";
import { rosterRules } from "@/lib/games";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Teams", "Captains and franchise names.");

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);

  const [teams, players, season] = await Promise.all([
    adminListTeamsForPicker(view.id),
    listPlayersForAdminSeason(view.id),
    prisma.season.findUnique({
      where: { id: view.id },
      select: { game: true, pubgMode: true },
    }),
  ]);
  const rules = rosterRules(season);
  const unsigned = players
    .filter((p) => !p.teamId && !p.isCaptain)
    .map((p) => ({ discordId: p.discordId, steamName: p.steamName }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Teams"
        subtitle={
          readOnly
            ? `Archive Season ${view.number} franchises — read-only.`
            : "Click a franchise to open its admin page."
        }
        pills={[
          { value: teams.length, label: "franchises" },
          { value: unsigned.length, label: "unsigned" },
        ]}
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/teams"
      />
      <AdminTeamsBoard
        teams={teams.map((team) => {
          const captain =
            team.players.find((p) => p.id === team.captainId) ??
            team.players.find((p) => p.isCaptain);
          return {
            id: team.id,
            name: team.name,
            tag: team.tag ?? null,
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
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        rosterMin={rules.min}
        rosterMax={rules.max}
      />
    </div>
  );
}
