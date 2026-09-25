import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { MEDALS, MEDAL_LABELS, ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { PLAY_WINDOW_LABELS } from "@/lib/play-window";
import { parseRolesJson } from "@/lib/roles";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminField,
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
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [player, teams] = await Promise.all([
    prisma.player.findUnique({
      where: { id },
      include: { team: { select: { id: true, name: true } } },
    }),
    adminListTeamsForPicker(),
  ]);
  if (!player) notFound();

  const roles = parseRolesJson(player.rolesJson);
  const currentRole = roles[0] ?? "";

  return (
    <div className="page">
      <AdminBackLink href="/admin/players" label="All players" />
      <PageHeader
        eyebrow="Admin · Player"
        title={player.steamName}
        subtitle={
          <code className="text-xs text-muted-foreground">{player.discordId}</code>
        }
        pills={[
          {
            label:
              MEDAL_LABELS[player.medal as keyof typeof MEDAL_LABELS] ??
              player.medal,
          },
          { label: player.team?.name ?? "Unsigned" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminCard tone="accent" className="lg:col-span-1">
          <AdminSection title="Profile">
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
                  defaultValue={player.medal}
                  className={adminControlClass}
                >
                  {MEDALS.map((m) => (
                    <option key={m} value={m}>
                      {MEDAL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </AdminField>
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
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Scoreboard alias">
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
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Roster">
            {player.team ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm text-muted-foreground">
                  On{" "}
                  <strong className="text-foreground">{player.team.name}</strong>
                  {player.rosterRole === "sub"
                    ? " as substitute"
                    : " as starter"}
                  .
                </p>
                {!player.isCaptain ? (
                  <AdminConfirmForm
                    action={actionSetRosterSlot}
                    message={
                      player.rosterRole === "sub"
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
                      value={player.rosterRole === "sub" ? "starter" : "sub"}
                    />
                    <AdminSubmitButton
                      variant="secondary" className="w-full text-xs"
                      pendingLabel="Updating…"
                    >
                      {player.rosterRole === "sub"
                        ? "Make starter"
                        : "Make substitute"}
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                ) : null}
                <AdminConfirmForm
                  action={actionRemoveFromTeam}
                  message={`Remove ${player.steamName} from ${player.team.name}?`}
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
              </div>
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
