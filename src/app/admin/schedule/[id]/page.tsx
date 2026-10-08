import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { prisma } from "@/lib/prisma";
import {
  asDate,
  formatScheduleWhen,
  scheduleUtcOffsetHours,
} from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminOutsideSeason,
  AdminField,
  AdminSection,
  AdminStatus,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { AdminScoreboardUpload } from "@/components/admin/scoreboard-upload";
import {
  actionDeleteFixture,
  actionRecordFixtureWinner,
  actionUpdateFixture,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const metadata = pageMeta("Admin Fixture", "Edit scheduled match.");

const TIMES = [
  "22",
  "23",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
];

function fixtureLocalParts(scheduledAt: Date | string) {
  const d = asDate(scheduledAt);
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(d.getTime() + offsetH * 3_600_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return {
    date: `${yyyy}-${mm}-${dd}`,
    hour: String(shifted.getUTCHours()),
  };
}

export default async function AdminFixtureDetailPage({
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
  const backHref = `/admin/schedule?season=${view.id}`;
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id },
    include: {
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
      match: { select: { id: true, winnerTeamId: true, openDotaId: true } },
    },
  });
  if (!fixture) notFound();
  if (fixture.seasonId !== view.id) {
    return <AdminOutsideSeason href={backHref} label="All fixtures" />;
  }
  const canEdit = !readOnly;
  const teams = await adminListTeamsForPicker(fixture.seasonId);

  const { date, hour } = fixtureLocalParts(fixture.scheduledAt);
  const isPending = fixture.status === "scheduled";
  const teamA = fixture.radiantTeam.name;
  const teamB = fixture.direTeam.name;
  const winnerName =
    fixture.match?.winnerTeamId === fixture.radiantTeamId
      ? teamA
      : fixture.match?.winnerTeamId === fixture.direTeamId
        ? teamB
        : fixture.radiantWins > fixture.direWins
          ? teamA
          : fixture.direWins > fixture.radiantWins
            ? teamB
            : null;
  const wasWalkover = Boolean(fixture.match?.openDotaId?.startsWith("walkover-"));

  return (
    <div className="page">
      <AdminBackLink href={backHref} label="All fixtures" />
      <PageHeader
        eyebrow="Admin · Schedule"
        title={`${teamA} vs ${teamB}`}
        subtitle={`${formatScheduleWhen(fixture.scheduledAt)} · ${fixture.kind} · ${fixture.status}`}
        pills={[
          {
            value: `${fixture.radiantWins}–${fixture.direWins}`,
            label: `Bo${fixture.bestOf}`,
          },
        ]}
      />

      {isPending && canEdit ? (
        <>
          <AdminScoreboardUpload
            fixtureId={fixture.id}
            teamA={teamA}
            teamB={teamB}
          />

          <AdminCard tone="accent" className="mb-6">
            <AdminSection title="Option B · No screenshot (win / walkover)">
              <p className="m-0 mb-3 text-sm text-muted-foreground">
                Use this when there is no scoreboard — e.g. walkover / no-show —
                or you only want to mark who won. For Bo3, tap again after each
                map until someone reaches 2 wins. If you upload a scoreboard
                above, you do not need these buttons.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <p className="m-0 text-sm font-semibold text-foreground">
                    {teamA}
                  </p>
                  <AdminConfirmForm
                    action={actionRecordFixtureWinner}
                    message={`Record ${teamA} beat ${teamB} (played)?`}
                    successMessage={`${teamA} wins`}
                  >
                    <input type="hidden" name="fixtureId" value={fixture.id} />
                    <input type="hidden" name="winnerName" value={teamA} />
                    <AdminSubmitButton pendingLabel="Saving…">
                      {teamA} wins
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                  <AdminConfirmForm
                    action={actionRecordFixtureWinner}
                    message={`Walkover: ${teamA} wins because ${teamB} is not coming?`}
                    successMessage={`Walkover — ${teamA} wins`}
                  >
                    <input type="hidden" name="fixtureId" value={fixture.id} />
                    <input type="hidden" name="winnerName" value={teamA} />
                    <input type="hidden" name="walkover" value="1" />
                    <AdminSubmitButton
                      variant="secondary"
                      className="text-xs"
                      pendingLabel="Saving…"
                    >
                      Walkover · {teamA} wins ({teamB} no-show)
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                </div>
                <div className="grid gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
                  <p className="m-0 text-sm font-semibold text-foreground">
                    {teamB}
                  </p>
                  <AdminConfirmForm
                    action={actionRecordFixtureWinner}
                    message={`Record ${teamB} beat ${teamA} (played)?`}
                    successMessage={`${teamB} wins`}
                  >
                    <input type="hidden" name="fixtureId" value={fixture.id} />
                    <input type="hidden" name="winnerName" value={teamB} />
                    <AdminSubmitButton pendingLabel="Saving…">
                      {teamB} wins
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                  <AdminConfirmForm
                    action={actionRecordFixtureWinner}
                    message={`Walkover: ${teamB} wins because ${teamA} is not coming?`}
                    successMessage={`Walkover — ${teamB} wins`}
                  >
                    <input type="hidden" name="fixtureId" value={fixture.id} />
                    <input type="hidden" name="winnerName" value={teamB} />
                    <input type="hidden" name="walkover" value="1" />
                    <AdminSubmitButton
                      variant="secondary"
                      className="text-xs"
                      pendingLabel="Saving…"
                    >
                      Walkover · {teamB} wins ({teamA} no-show)
                    </AdminSubmitButton>
                  </AdminConfirmForm>
                </div>
              </div>
            </AdminSection>
          </AdminCard>
        </>
      ) : (
        <AdminCard className="mb-6">
          <AdminSection title="Result">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatus tone="ok">completed</AdminStatus>
              {winnerName ? (
                <AdminStatus tone="gold">
                  {wasWalkover
                    ? `Walkover · ${winnerName} wins`
                    : `${winnerName} wins`}
                </AdminStatus>
              ) : null}
              <span className="text-sm text-muted-foreground">
                Series {fixture.radiantWins}–{fixture.direWins}
                {fixture.matchId ? " · match linked" : ""}
              </span>
            </div>
            {fixture.matchId ? (
              <p className="mt-3 mb-0 text-sm">
                <a
                  href={`/admin/matches/${fixture.matchId}?season=${view.id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Open match editor
                </a>{" "}
                (fix OCR names / stand-ins)
              </p>
            ) : null}
          </AdminSection>
        </AdminCard>
      )}

      {canEdit ? (
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard tone="accent">
          <AdminSection title="Edit">
            <AdminConfirmForm
              action={actionUpdateFixture}
              message={`Save schedule changes for ${teamA} vs ${teamB}?`}
              className="grid gap-3"
            >
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <AdminField label="Team A">
                <select
                  name="teamA"
                  defaultValue={teamA}
                  className={adminControlClass}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Team B">
                <select
                  name="teamB"
                  defaultValue={teamB}
                  className={adminControlClass}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Date">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={date}
                  className={adminControlClass}
                />
              </AdminField>
              <AdminField label="Hour PKT">
                <select
                  name="time"
                  defaultValue={
                    TIMES.includes(hour) ? hour : TIMES[0] ?? "22"
                  }
                  className={adminControlClass}
                >
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}:00
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminSubmitButton>
                Save edit
              </AdminSubmitButton>
            </AdminConfirmForm>
          </AdminSection>
        </AdminCard>

        <AdminCard tone="danger">
          <AdminSection title="Danger">
            <AdminConfirmForm
              action={actionDeleteFixture}
              message={`Delete fixture ${teamA} vs ${teamB}? This cannot be undone.`}
            >
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <AdminSubmitButton
                variant="secondary" className="text-xs"
                pendingLabel="Deleting…"
              >
                Delete fixture
              </AdminSubmitButton>
            </AdminConfirmForm>
          </AdminSection>
        </AdminCard>
      </div>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          {teamA} vs {teamB}. This season is read-only.
        </p>
      )}
    </div>
  );
}
