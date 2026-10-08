import { PageHeader } from "@/components/common";
import { AdminCard, AdminField, AdminSection, adminControlClass } from "@/components/admin/ui";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin/form-controls";
import { actionRecordPubgResult } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { PUBG_MAPS, pubgModeLabel, rosterRules } from "@/lib/games";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { pageMeta } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { matchPoints } from "@/lib/pubg-scoring";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin PUBG results", "Record a PUBG lobby result.");

export default async function AdminPubgPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, readOnly } =
    await resolveAdminSeasonView(sp.season);
  const pubg = view.game === "PUBG";
  const season = pubg
    ? await prisma.season.findUnique({ where: { id: view.id } })
    : null;
  const rules = rosterRules(season);
  const [lobbies, teams] = pubg
    ? await Promise.all([
        listPubgLobbies(view.id),
        adminListTeamsForPicker(view.id),
      ])
    : [[], []];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="PUBG results"
        subtitle={
          pubg
            ? `${season?.name ?? view.name} · ${pubgModeLabel(season?.pubgMode)}. Points are placement plus 1 per kill.`
            : "This season is Dota 2. Switch the season picker to a PUBG cup to record lobbies."
        }
      />
      {pubg && !readOnly ? (
        <AdminCard>
          <AdminSection title="Add a team result">
            <p className="mb-3 text-xs text-muted-foreground">
              Use the same label to add more teams to one lobby. Player lines:{" "}
              <code>Name, kills, damage</code>. Leave players blank to save only the team place.
              Up to {rules.max} players.
            </p>
            <AdminActionForm
              action={actionRecordPubgResult}
              successMessage="Lobby result saved"
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="seasonId" value={view.id} />
              <AdminField label="Lobby label">
                <input name="label" required placeholder="Game 1" className={adminControlClass} />
              </AdminField>
              <AdminField label="Map">
                <select name="map" required className={adminControlClass} defaultValue="Erangel">
                  {PUBG_MAPS.map((map) => (
                    <option key={map} value={map}>
                      {map}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Team">
                <select name="teamName" required className={adminControlClass} defaultValue="">
                  <option value="" disabled>
                    {teams.length === 0 ? "No teams in this season" : "Choose a team"}
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Place">
                <input name="placement" type="number" min={1} max={16} required className={adminControlClass} />
              </AdminField>
              <AdminField label="Team kills">
                <input name="kills" type="number" min={0} required className={adminControlClass} />
              </AdminField>
              <AdminField label="Played at">
                <input name="playedAt" type="datetime-local" className={adminControlClass} />
              </AdminField>
              <AdminField label="Result image" className="sm:col-span-2">
                <input name="screenshot" type="file" accept="image/*" className={adminControlClass} />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Optional. Stored with this lobby and map. Placement and kills on this form are what publish to the points table.
                </span>
              </AdminField>
              <AdminField label="Players" className="sm:col-span-2">
                <textarea
                  name="players"
                  rows={rules.max}
                  placeholder={"Ali, 4, 900\nSara, 2, 400"}
                  className={adminControlClass}
                />
              </AdminField>
              <div className="sm:col-span-2">
                <AdminSubmitButton>Save result</AdminSubmitButton>
              </div>
            </AdminActionForm>
          </AdminSection>
        </AdminCard>
      ) : null}

      <div className="mt-6 grid gap-4">
        {pubg && lobbies.filter((lobby) => lobby.status !== "scheduled").length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No results saved for this season yet.
          </p>
        ) : null}
        {lobbies.filter((lobby) => lobby.status !== "scheduled").map((lobby) => (
          <AdminCard key={lobby.id}>
            <AdminSection title={`${lobby.label || "Lobby"} · ${lobby.map}`}>
              {lobby.sourceImagePath ? (
                <p className="mb-2 text-sm">
                  <a href={lobby.sourceImagePath} className="text-primary underline-offset-2 hover:underline">
                    Source image
                  </a>
                </p>
              ) : null}
              <ul className="m-0 grid list-none gap-2 p-0 text-sm">
                {lobby.teams
                  .filter((row) => row.placement != null)
                  .map((row) => (
                  <li key={row.id}>
                    <strong>#{row.placement}</strong> {row.team.name} · {row.kills} kills ·{" "}
                    {matchPoints(row.placement ?? 0, row.kills)} pts
                  </li>
                ))}
              </ul>
            </AdminSection>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
