import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { ROLE_LABELS, labelForMedal, medalsForGame } from "@/lib/constants";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { prisma } from "@/lib/prisma";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { PLAY_WINDOW_LABELS } from "@/lib/play-window";
import { parseRolesJson } from "@/lib/roles";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminField,
  AdminOutsideSeason,
  AdminSection,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminActionForm,
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  actionAddAlias,
  actionAddToTeam,
  actionRemoveFromTeam,
  actionSetRosterSlot,
  actionUpdatePlayer,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Player", "Edit player profile.");

export default async function AdminPlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const { view, readOnly } = await resolveAdminSeasonView(sp.season);
  const backHref = `/admin/players?season=${view.id}`;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) notFound();
  const [membership, teams] = await Promise.all([
    prisma.seasonPlayer.findUnique({
      where: { seasonId_playerId: { seasonId: view.id, playerId: player.id } },
      include: { team: { select: { id: true, name: true } } },
    }),
    adminListTeamsForPicker(view.id),
  ]);
  if (!membership) {
    return <AdminOutsideSeason href={backHref} label="All players" />;
  }

  const pubg = view.game === "PUBG";
  const roles = parseRolesJson(membership.rolesJson || player.rolesJson);
  const currentRole = roles[0] ?? "";
  const medal = membership.medal || player.medal;
  const team = membership.team;

  return (
    <div className="page">
      <AdminBackLink href={backHref} label="All players" />
      <PageHeader
        eyebrow="Admin · Player"
        title={pubg && player.pubgName ? player.pubgName : player.steamName}
        subtitle={
          <code className="text-xs text-muted-foreground">{player.discordId}</code>
        }
        pills={[
          {
            label: labelForMedal(medal) ?? medal,
          },
          { label: team?.name ?? "Unsigned" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminCard tone="accent" className="lg:col-span-1">
          <AdminSection title="Profile">
            {readOnly ? (
              <p className="m-0 text-sm text-muted-foreground">
                This season is read-only.
              </p>
            ) : (
            <AdminConfirmForm
              action={actionUpdatePlayer}
              message={`Save profile changes for ${player.steamName}?`}
              className="grid gap-3"
            >
              <input type="hidden" name="discordId" value={player.discordId} />
              <AdminField label="Display name">
                <input
                  name="steamName"
                  defaultValue={player.steamName}
                  className={adminControlClass}
                />
              </AdminField>
              <AdminField label="Medal">
                <select
                  name="medal"
                  defaultValue={medal}
                  className={adminControlClass}
                >
                  {(medalsForGame(view.game) as readonly string[]).includes(
                    medal,
                  ) ? null : (
                    <option value={medal}>{labelForMedal(medal)}</option>
                  )}
                  {medalsForGame(view.game).map((m) => (
                    <option key={m} value={m}>
                      {labelForMedal(m)}
                    </option>
                  ))}
                </select>
              </AdminField>
              {pubg ? null : (
              <AdminField label="Role">
                <select
                  name="role"
                  defaultValue={currentRole}
                  className={adminControlClass}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </AdminField>
              )}
              <AdminField label="Weekend window">
                <select
                  name="playWindow"
                  defaultValue={player.playWindow ?? "both"}
                  className={adminControlClass}
                >
                  {Object.entries(PLAY_WINDOW_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminSubmitButton>
                Save profile
              </AdminSubmitButton>
            </AdminConfirmForm>
            )}
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Scoreboard alias">
            {readOnly ? (
              <p className="m-0 text-sm text-muted-foreground">
                Aliases stay with the player. This season is read-only.
              </p>
            ) : (
            <AdminActionForm
              action={actionAddAlias}
              successMessage="Alias added"
              className="grid gap-3"
            >
              <input type="hidden" name="discordId" value={player.discordId} />
              <AdminField label="Alias text">
                <input
                  name="alias"
                  required
                  placeholder="OCR misspelling"
                  className={adminControlClass}
                />
              </AdminField>
              <AdminSubmitButton variant="secondary" pendingLabel="Adding…">
                Add alias
              </AdminSubmitButton>
            </AdminActionForm>
            )}
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Roster">
            {team ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm text-muted-foreground">
                  On{" "}
                  <strong className="text-foreground">{team.name}</strong>
                  {membership.rosterRole === "sub"
                    ? " as substitute"
                    : " as starter"}
                  .
                </p>
                {!readOnly && !membership.isCaptain && !pubg ? (
                  <AdminConfirmForm
                    action={actionSetRosterSlot}
                    message={
                      membership.rosterRole === "sub"
                        ? `Make ${player.steamName} a starter?`
                        : `Make ${player.steamName} a substitute?`
                    }
                  >
                    <input
                      type="hidden"
                      name="discordId"
                      value={player.discordId}
                    />
                    <input
                      type="hidden"
                      name="slot"
                      value={membership.rosterRole === "sub" ? "starter" : "sub"}
                    />
                    <AdminSubmitButton
                      variant="secondary" className="w-full text-xs"
                      pendingLabel="Updating…"
                    >
                      {membership.rosterRole === "sub"
                        ? "Make starter"
                        : "Make substitute"}
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                ) : null}
                {!readOnly ? (
                <AdminConfirmForm
                  action={actionRemoveFromTeam}
                  message={`Remove ${player.steamName} from ${team.name}?`}
                >
                  <input
                    type="hidden"
                    name="discordId"
                    value={player.discordId}
                  />
                  <AdminSubmitButton
                    variant="secondary" className="w-full text-xs"
                    pendingLabel="Removing…"
                  >
                    Remove from team
                  </AdminSubmitButton>
                </AdminConfirmForm>
                ) : null}
              </div>
            ) : readOnly ? (
              <p className="m-0 text-sm text-muted-foreground">Unsigned in this season.</p>
            ) : (
              <AdminConfirmForm
                action={actionAddToTeam}
                message={`Add ${player.steamName} to the selected team?`}
                className="grid gap-3"
              >
                <input type="hidden" name="discordId" value={player.discordId} />
                <AdminField label="Team">
                  <select
                    name="teamName"
                    required
                    className={adminControlClass}
                  >
                    <option value="">Pick team…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminSubmitButton pendingLabel="Adding…">
                  Add to team
                </AdminSubmitButton>
              </AdminConfirmForm>
            )}
          </AdminSection>
        </AdminCard>
      </div>
    </div>
  );
}
