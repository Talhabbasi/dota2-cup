import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import {
  adminGetMatch,
  adminListPlayersForPicker,
  adminListTeamsForPicker,
} from "@/lib/match-admin";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { screenshotDisplayUrl } from "@/lib/screenshot-url";
import {
  AdminBackLink,
  AdminCard,
  AdminField,
  AdminSection,
  AdminStatus,
  adminBtnClass,
  adminBtnSecondaryClass,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  actionLinkMatchPlayer,
  actionMarkStandIn,
  actionSetMatchTeams,
} from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import { AdminMatchScreenshotUpload } from "@/components/admin/match-screenshot-upload";

export const dynamic = "force-dynamic";

export const metadata = pageMeta("Admin Match", "Edit match result and OCR.");

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [match, players, teams] = await Promise.all([
    adminGetMatch(id),
    adminListPlayersForPicker(),
    adminListTeamsForPicker(),
  ]);
  if (!match) notFound();

  const radiantName = match.radiantTeam?.name ?? "Radiant?";
  const direName = match.direTeam?.name ?? "Dire?";
  const shotUrl = screenshotDisplayUrl(match.screenshotPath);

  return (
    <div className="page">
      <AdminBackLink href="/admin/matches" label="All matches" />
      <PageHeader
        eyebrow="Admin · Match"
        title={`${radiantName} vs ${direName}`}
        subtitle={formatScheduleWhen(match.createdAt)}
        actions={
          <Link href={`/matches/${match.id}`} className={cn(adminBtnClass, adminBtnSecondaryClass, "text-xs")}>
            Public page
          </Link>
        }
      />

      <AdminCard className="mb-6">
        <AdminSection title="Scoreboard screenshot">
          {shotUrl ? (
            <a
              href={shotUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 block overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shotUrl}
                alt="Match scoreboard"
                className="h-auto w-full object-contain"
              />
            </a>
          ) : match.screenshotPath ? (
            <p className="mb-4 text-sm text-amber-200/90">
              This match still points at an old local file (
              <code className="text-xs">{match.screenshotPath}</code>
              ). Upload below to store it on S3 and fix the link.
            </p>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              No screenshot yet. Upload a SCOREBOARD image — it is saved to S3
              first, then linked here.
            </p>
          )}
          <AdminMatchScreenshotUpload matchId={match.id} />
        </AdminSection>
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard tone="accent">
          <AdminSection title="Teams & result">
            <AdminConfirmForm
              action={actionSetMatchTeams}
              message={`Save teams/winner for ${radiantName} vs ${direName}?`}
              className="grid gap-3"
            >
              <input type="hidden" name="matchId" value={match.id} />
              <AdminField label="Radiant">
                <select
                  name="radiantTeamId"
                  defaultValue={match.radiantTeam?.id ?? ""}
                  className={adminControlClass}
                >
                  <option value="">—</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Dire">
                <select
                  name="direTeamId"
                  defaultValue={match.direTeam?.id ?? ""}
                  className={adminControlClass}
                >
                  <option value="">—</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Winner">
                <select
                  name="winnerSide"
                  defaultValue={
                    match.radiantWin === true
                      ? "radiant"
                      : match.radiantWin === false
                        ? "dire"
                        : ""
                  }
                  className={adminControlClass}
                >
                  <option value="">—</option>
                  <option value="radiant">Radiant</option>
                  <option value="dire">Dire</option>
                </select>
              </AdminField>
              <AdminSubmitButton>
                Save result
              </AdminSubmitButton>
            </AdminConfirmForm>
          </AdminSection>
        </AdminCard>

        <AdminCard>
          <AdminSection title="Scoreboard seats">
            <ul className="m-0 grid list-none gap-3 p-0">
              {match.players.map((seat) => {
                const status = seat.asStandIn
                  ? "stand-in"
                  : seat.unknown || !seat.playerId
                    ? "unmatched"
                    : "linked";
                return (
                  <li
                    key={seat.id}
                    className="rounded-lg border border-white/10 bg-[#0a0d14]/60 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <AdminStatus
                        tone={seat.side === "radiant" ? "ok" : "danger"}
                      >
                        {seat.side}
                      </AdminStatus>
                      <strong className="text-sm">
                        {seat.boardName || seat.player?.steamName || "—"}
                      </strong>
                      {seat.player ? (
                        <span className="text-xs text-muted-foreground">
                          → {seat.player.steamName}
                        </span>
                      ) : null}
                      <AdminStatus
                        tone={
                          status === "linked"
                            ? "ok"
                            : status === "stand-in"
                              ? "neutral"
                              : "danger"
                        }
                      >
                        {status}
                      </AdminStatus>
                      <span className="text-xs text-muted-foreground">
                        {seat.hero}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminConfirmForm
                        action={actionLinkMatchPlayer}
                        message={`Link this scoreboard seat to the selected player?`}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="matchPlayerId"
                          value={seat.id}
                        />
                        <select
                          name="playerId"
                          required
                          defaultValue={seat.playerId ?? ""}
                          className={`${adminControlClass} max-w-full min-w-0 flex-1`}
                        >
                          <option value="">Link player…</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.steamName}
                              {p.team?.name ? ` (${p.team.name})` : ""}
                            </option>
                          ))}
                        </select>
                        <AdminSubmitButton
                          variant="secondary" className="text-xs"
                          pendingLabel="Linking…"
                        >
                          Link
                        </AdminSubmitButton>
                      </AdminConfirmForm>
                      <AdminConfirmForm
                        action={actionMarkStandIn}
                        message={`Mark "${seat.boardName || seat.player?.steamName || "this seat"}" as a stand-in?`}
                      >
                        <input
                          type="hidden"
                          name="matchPlayerId"
                          value={seat.id}
                        />
                        <AdminSubmitButton
                          variant="secondary" className="text-xs"
                          pendingLabel="Saving…"
                        >
                          Stand-in
                        </AdminSubmitButton>
                      </AdminConfirmForm>
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminSection>
        </AdminCard>
      </div>
    </div>
  );
}
