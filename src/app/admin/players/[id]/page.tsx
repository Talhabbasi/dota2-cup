import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ROLE_LABELS,
  STARTING_ROLES,
  labelForMedal,
  medalsForGame,
  type StartingRole,
} from "@/lib/constants";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { prisma } from "@/lib/prisma";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { parseRolesJson } from "@/lib/roles";
import { pageMeta } from "@/lib/seo";
import { formatModifiedAt } from "@/lib/modified-filter";
import { steam32To64, steamProfileUrl } from "@/lib/steam";
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
  actionRemoveAlias,
  actionAddToTeam,
  actionRemoveFromTeam,
  actionSetRosterSlot,
  actionUpdatePlayer,
} from "@/app/admin/actions";
import { DeletePlayerForm } from "@/components/admin/delete-player-form";

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
  const player = await prisma.player.findUnique({
    where: { id },
    include: { aliases: { orderBy: { alias: "asc" } } },
  });
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
  const roles = parseRolesJson(membership.rolesJson || player.rolesJson).filter(
    (r): r is StartingRole =>
      (STARTING_ROLES as readonly string[]).includes(r),
  );
  const medal = membership.medal || player.medal;
  const team = membership.team;
  const steam64 =
    player.steam32 == null ? null : steam32To64(player.steam32).toString();
  const steamUrl = steam64 ? steamProfileUrl(steam64) : "";

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
              <AdminField label="Discord name">
                <input
                  name="discordName"
                  defaultValue={player.discordName}
                  className={adminControlClass}
                />
              </AdminField>
              <AdminField label="Display name">
                <input
                  name="steamName"
                  defaultValue={player.steamName}
                  className={adminControlClass}
                />
              </AdminField>
              <AdminField label="New Steam profile or ID">
                <input
                  name="steam"
                  placeholder={
                    steamUrl ||
                    (player.steam32 != null
                      ? `Leave blank to keep ${player.steam32}`
                      : "Profile URL, Steam64, or Steam32")
                  }
                  className={adminControlClass}
                />
              </AdminField>
              <p className="m-0 text-xs text-muted-foreground">
                Discord ID <code>{player.discordId.split(":")[0]}</code>
                {player.steam32 != null ? (
                  <>
                    {" "}
                    · Steam32 <code>{player.steam32}</code>
                    {steam64 ? (
                      <>
                        {" "}
                        · Steam64 <code>{steam64}</code>
                      </>
                    ) : null}
                  </>
                ) : (
                  " · No Steam ID yet"
                )}
                {membership.paidAt
                  ? ` · Paid ${formatModifiedAt(membership.paidAt.toISOString())}`
                  : " · Unpaid"}
                {` · Added ${formatModifiedAt(membership.createdAt.toISOString())}`}
                {` · Updated ${formatModifiedAt(membership.updatedAt.toISOString())}`}
              </p>
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
              <AdminField label="Roles">
                <div className="flex flex-wrap gap-2">
                  {STARTING_ROLES.map((value) => (
                    <label
                      key={value}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={value}
                        defaultChecked={roles.includes(value)}
                      />
                      {ROLE_LABELS[value]}
                    </label>
                  ))}
                </div>
              </AdminField>
              )}
              <input
                type="hidden"
                name="playWindow"
                value={player.playWindow ?? "both"}
              />
              <AdminSubmitButton>
                Save profile
              </AdminSubmitButton>
            </AdminConfirmForm>
            )}
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Scoreboard alias">
            {player.aliases.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No aliases saved.</p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {player.aliases.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-2.5 py-1.5"
                  >
                    <code className="text-sm text-foreground">{row.alias}</code>
                    {readOnly ? null : (
                      <AdminConfirmForm
                        action={actionRemoveAlias}
                        message={`Remove alias ${row.alias}?`}
                        successMessage="Alias removed"
                      >
                        <input type="hidden" name="discordId" value={player.discordId} />
                        <input type="hidden" name="alias" value={row.alias} />
                        <AdminSubmitButton
                          variant="ghost"
                          className="text-xs"
                          pendingLabel="Removing…"
                        >
                          Remove
                        </AdminSubmitButton>
                      </AdminConfirmForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
                  placeholder="Name as it appears on the scoreboard"
                  className={adminControlClass}
                />
              </AdminField>
              <p className="m-0 text-xs text-muted-foreground">
                Spaces and symbols are removed when it is saved, so “Foo Bar” is stored as foobar.
              </p>
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

      {!readOnly ? (
        <AdminCard className="mt-6 border-rose-500/25">
          <AdminSection title="Danger zone">
            {membership.isCaptain || player.isCaptain ? (
              <p className="m-0 text-sm text-muted-foreground">
                This player is a captain. Change or remove the captain first,
                then you can delete the registration.
              </p>
            ) : (
              <div className="grid gap-3">
                <p className="m-0 text-sm text-muted-foreground">
                  Permanently deletes this registration (same as Discord{" "}
                  <code className="text-xs">/player delete</code>). Auction must
                  be idle. They can register again later.
                </p>
                <DeletePlayerForm
                  discordId={player.discordId}
                  seasonId={view.id}
                  playerName={player.steamName}
                  teamName={team?.name}
                />
              </div>
            )}
          </AdminSection>
        </AdminCard>
      ) : null}
    </div>
  );
}
