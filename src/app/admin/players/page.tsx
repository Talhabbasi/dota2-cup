import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { ROLE_LABELS, labelForMedal, medalsForGame } from "@/lib/constants";
import {
  listPlayersForAdminSeason,
  listPlayersNotInLiveSeason,
} from "@/lib/players-admin";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { PLAY_WINDOW_LABELS } from "@/lib/play-window";
import { pageMeta } from "@/lib/seo";
import { AdminPlayersBoard } from "@/components/admin/players-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Players", "Register and manage players.");

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);

  const [players, linkable, teams] = await Promise.all([
    listPlayersForAdminSeason(view.id),
    readOnly ? Promise.resolve([]) : listPlayersNotInLiveSeason(),
    adminListTeamsForPicker(view.id),
  ]);

  const medalOptions = medalsForGame(view.game).map(
    (m) => ({
      value: m,
      label: labelForMedal(m),
    }),
  );
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
        subtitle={
          readOnly
            ? `Archive Season ${view.number} roster — read-only. Live registration stays on the active cup.`
            : "Live season pool. Returning players match by Steam ID on register, or link them manually below."
        }
        pills={[
          { value: players.length, label: "in this season" },
          {
            value: players.filter((p) => !p.teamId).length,
            label: "unsigned",
          },
          ...(readOnly
            ? []
            : [{ value: linkable.length, label: "not linked yet" }]),
        ]}
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/players"
      />
      <AdminPlayersBoard
        players={players.map((p) => ({
          id: p.id,
          discordId: p.discordId,
          steamName: p.steamName,
          pubgName: p.pubgName,
          medal: p.medal,
          medalLabel:
            labelForMedal(p.medal),
          teamName: p.team?.name ?? null,
          isCaptain: p.isCaptain,
          rosterRole: p.rosterRole,
        }))}
        linkablePlayers={linkable.map((p) => ({
          id: p.id,
          steamName: p.steamName,
          discordId: p.discordId,
          medalLabel:
            labelForMedal(p.medal),
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        medalOptions={medalOptions}
        roleOptions={roleOptions}
        windowOptions={windowOptions}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        game={view.game}
      />
    </div>
  );
}
