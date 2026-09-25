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
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  actionDeleteFixture,
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

  return (
    <div className="page">
      <AdminBackLink href="/admin/schedule" label="All fixtures" />
      <PageHeader
        eyebrow="Admin · Schedule"
        title={`${fixture.radiantTeam.name} vs ${fixture.direTeam.name}`}
        subtitle={`${formatScheduleWhen(fixture.scheduledAt)} · ${fixture.kind} · ${fixture.status}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard tone="accent">
          <AdminSection title="Edit">
            <AdminConfirmForm
              action={actionUpdateFixture}
              message={`Save schedule changes for ${fixture.radiantTeam.name} vs ${fixture.direTeam.name}?`}
              className="grid gap-3"
            >
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <AdminField label="Team A">
                <select
                  name="teamA"
                  defaultValue={fixture.radiantTeam.name}
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
                  defaultValue={fixture.direTeam.name}
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
              message={`Delete fixture ${fixture.radiantTeam.name} vs ${fixture.direTeam.name}? This cannot be undone.`}
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
