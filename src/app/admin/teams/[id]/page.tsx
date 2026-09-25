import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { formatPoints } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { listRegisteredPlayers } from "@/lib/players-admin";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminField,
  AdminSection,
  AdminStatus,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  actionChangeCaptain,
  actionRemoveCaptain,
  actionRemoveFromTeam,
  actionRenameTeam,
  actionSetRosterSlot,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Team", "Edit franchise.");

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [team, players] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          select: {
            id: true,
            discordId: true,
            steamName: true,
            isCaptain: true,
            rosterRole: true,
          },
          orderBy: [{ isCaptain: "desc" }, { steamName: "asc" }],
        },
      },
    }),
    listRegisteredPlayers(),
  ]);
  if (!team) notFound();

  const captain =
    team.players.find((p) => p.id === team.captainId) ??
    team.players.find((p) => p.isCaptain);

  return (
    <div className="page">
      <AdminBackLink href="/admin/teams" label="All teams" />
      <PageHeader
        eyebrow="Admin · Team"
        title={team.name}
        subtitle={`Purse ${formatPoints(team.purse)} · ${team.players.length} players`}
        pills={
          captain ? [{ label: `Captain ${captain.steamName}` }] : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AdminCard tone="accent">
            <AdminSection title="Franchise">
              <AdminConfirmForm
                action={actionRenameTeam}
                message={`Rename team "${team.name}"?`}
                className="grid gap-3"
              >
                <input type="hidden" name="teamName" value={team.name} />
                <AdminField label="New name">
                  <input
                    name="newName"
                    required
                    defaultValue={team.name}
                    className={adminControlClass}
                  />
                </AdminField>
                <AdminSubmitButton>
                  Rename
                </AdminSubmitButton>
              </AdminConfirmForm>
              <AdminConfirmForm
                action={actionChangeCaptain}
                message={`Change captain for "${team.name}"?`}
                className="mt-4 grid gap-3"
              >
                <input type="hidden" name="teamName" value={team.name} />
                <AdminField label="Change captain">
                  <select
                    name="discordId"
                    required
                    className={adminControlClass}
                    defaultValue={captain?.discordId ?? ""}
                  >
                    <option value="">Pick player…</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.discordId}>
                        {p.steamName}
                        {p.team?.name ? ` (${p.team.name})` : ""}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminSubmitButton variant="secondary" pendingLabel="Updating…">
                  Set captain
                </AdminSubmitButton>
              </AdminConfirmForm>
            </AdminSection>
          </AdminCard>

          {captain ? (
            <AdminCard tone="danger">
              <AdminSection title="Danger">
                <AdminConfirmForm
                  action={actionRemoveCaptain}
                  message={`Dissolve team "${team.name}"? All players will be unsigned. This cannot be undone.`}
                  className="grid gap-2"
                >
                  <input
                    type="hidden"
                    name="discordId"
                    value={captain.discordId}
                  />
                  <p className="m-0 text-xs text-rose-300/90">
                    Dissolves the franchise and unsigns everyone.
                  </p>
                  <AdminSubmitButton
                    variant="secondary" className="text-xs"
                    pendingLabel="Dissolving…"
                  >
                    Dissolve team
                  </AdminSubmitButton>
                </AdminConfirmForm>
              </AdminSection>
            </AdminCard>
          ) : null}
        </div>

        <AdminCard>
          <AdminSection title="Roster">
            <ul className="m-0 grid list-none gap-2 p-0">
              {team.players.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0a0d14]/60 px-3 py-2"
                >
                  <span className="text-sm">
                    <strong>{p.steamName}</strong>{" "}
                    <AdminStatus
                      tone={
                        p.isCaptain
                          ? "gold"
                          : p.rosterRole === "sub"
                            ? "neutral"
                            : "ok"
                      }
                    >
                      {p.isCaptain
                        ? "captain"
                        : p.rosterRole === "sub"
                          ? "sub"
                          : "starter"}
                    </AdminStatus>
                  </span>
                  {!p.isCaptain ? (
                    <span className="flex gap-1">
                      <AdminConfirmForm
                        action={actionSetRosterSlot}
                        message={
                          p.rosterRole === "sub"
                            ? `Make ${p.steamName} a starter on ${team.name}?`
                            : `Make ${p.steamName} a substitute on ${team.name}?`
                        }
                      >
                        <input
                          type="hidden"
                          name="discordId"
                          value={p.discordId}
                        />
                        <input
                          type="hidden"
                          name="slot"
                          value={p.rosterRole === "sub" ? "starter" : "sub"}
                        />
                        <AdminSubmitButton
                          variant="secondary" className="text-xs"
                          pendingLabel="…"
                        >
                          {p.rosterRole === "sub" ? "Starter" : "Sub"}
                        </AdminSubmitButton>
                      </AdminConfirmForm>
                      <AdminConfirmForm
                        action={actionRemoveFromTeam}
                        message={`Remove ${p.steamName} from ${team.name}?`}
                      >
                        <input
                          type="hidden"
                          name="discordId"
                          value={p.discordId}
                        />
                        <AdminSubmitButton
                          variant="secondary" className="text-xs"
                          pendingLabel="…"
                        >
                          Remove
                        </AdminSubmitButton>
                      </AdminConfirmForm>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AdminSection>
        </AdminCard>
      </div>
    </div>
  );
}
