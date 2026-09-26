import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
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
  actionDeleteFixture,
  actionRecordFixtureWinner,
  actionUpdateFixture,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";
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
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [fixture, teams] = await Promise.all([
    prisma.scheduledFixture.findUnique({
      where: { id },
      include: {
        radiantTeam: { select: { name: true } },
        direTeam: { select: { name: true } },
      },
    }),
    adminListTeamsForPicker(),
  ]);
  if (!fixture) notFound();

  const { date, hour } = fixtureLocalParts(fixture.scheduledAt);
  const isPending = fixture.status === "scheduled";
  const teamA = fixture.radiantTeam.name;
  const teamB = fixture.direTeam.name;

  return (
    <div className="page">
      <AdminBackLink href="/admin/schedule" label="All fixtures" />
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

      {isPending ? (
        <AdminCard tone="accent" className="mb-6">
          <AdminSection title="Result / walkover">
            <p className="m-0 mb-3 text-sm text-muted-foreground">
              Upcoming match — record who won after they played, or give the win
              as a walkover when the other team / player is not coming.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminConfirmForm
                action={actionRecordFixtureWinner}
                message={`Record ${teamA} win vs ${teamB}? Use Walkover if the other side no-showed.`}
                successMessage={`${teamA} recorded as winner`}
                className="grid gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3"
              >
                <input type="hidden" name="fixtureId" value={fixture.id} />
                <input type="hidden" name="winnerName" value={teamA} />
                <p className="m-0 text-sm font-semibold text-foreground">
                  {teamA} wins
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="walkover" value="1" />
                  Walkover (other side not coming)
                </label>
                <AdminSubmitButton pendingLabel="Saving…">
                  {teamA} win
                </AdminSubmitButton>
              </AdminConfirmForm>
              <AdminConfirmForm
                action={actionRecordFixtureWinner}
                message={`Record ${teamB} win vs ${teamA}? Use Walkover if the other side no-showed.`}
                successMessage={`${teamB} recorded as winner`}
                className="grid gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3"
              >
                <input type="hidden" name="fixtureId" value={fixture.id} />
                <input type="hidden" name="winnerName" value={teamB} />
                <p className="m-0 text-sm font-semibold text-foreground">
                  {teamB} wins
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="walkover" value="1" />
                  Walkover (other side not coming)
                </label>
                <AdminSubmitButton pendingLabel="Saving…">
                  {teamB} win
                </AdminSubmitButton>
              </AdminConfirmForm>
            </div>
          </AdminSection>
        </AdminCard>
      ) : (
        <AdminCard className="mb-6">
          <AdminSection title="Result">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatus tone="ok">completed</AdminStatus>
              <span className="text-sm text-muted-foreground">
                Series {fixture.radiantWins}–{fixture.direWins}
                {fixture.matchId ? " · match linked" : ""}
              </span>
            </div>
          </AdminSection>
        </AdminCard>
      )}

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
    </div>
  );
}
