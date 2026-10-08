import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { listCupSchedule } from "@/lib/schedule-crud";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { AdminScheduleBoard } from "@/components/admin/schedule-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Schedule", "Add and edit fixtures.");

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);

  const pubg = view.game === "PUBG";
  const [teams, fixtures, lobbies] = await Promise.all([
    adminListTeamsForPicker(view.id),
    pubg
      ? Promise.resolve([])
      : listCupSchedule({ publicOnly: false, seasonId: view.id }),
    pubg ? listPubgLobbies(view.id) : Promise.resolve([]),
  ]);
  const shown = readOnly
    ? fixtures
    : fixtures.filter((f) => f.status === "scheduled");
  const pending = fixtures.filter((f) => f.status === "scheduled");
  const scheduledLobbies = lobbies.filter((lobby) => lobby.status === "scheduled");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Schedule"
        subtitle={
          readOnly
            ? `Archive ${view.game === "PUBG" ? "PUBG" : "Dota"} Season ${view.number} — read-only.`
            : pubg
              ? "Book a custom lobby: map, start time, and the squads from this season."
              : "Book Team A vs Team B. Open a fixture to upload a scoreboard or mark a win."
        }
        pills={[
          pubg
            ? {
                value: readOnly ? lobbies.length : scheduledLobbies.length,
                label: readOnly ? "lobbies" : "pending",
              }
            : {
                value: readOnly ? shown.length : pending.length,
                label: readOnly ? "fixtures" : "pending",
              },
        ]}
      />
      <AdminScheduleBoard
        fixtures={shown.map((f) => ({
          id: f.id,
          when: formatScheduleWhen(f.scheduledAt),
          teamA: f.radiantTeam.name,
          teamB: f.direTeam.name,
          kind: f.kind,
          status: f.status,
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        game={view.game}
        seasonId={view.id}
        lobbies={lobbies
          .filter((lobby) => lobby.status === "scheduled")
          .map((lobby) => ({
            id: lobby.id,
            when: formatScheduleWhen(lobby.playedAt),
            label: lobby.label || "Lobby",
            map: lobby.map,
            teamNames: lobby.teams.map((row) => row.team.name),
          }))}
      />
    </div>
  );
}
