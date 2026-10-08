import Link from "next/link";
import { PageHeader } from "@/components/common";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { listAdminActivityLogs } from "@/lib/admin-log";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Logs",
  "Who changed what in the organizer panel.",
);

function formatWhen(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);
  const logs = await listAdminActivityLogs(150);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Activity logs"
        subtitle="Plain-language history of organizer changes — who did what."
        pills={[{ value: logs.length, label: "shown" }]}
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/"
      />
      <p className="mb-4 text-sm text-muted-foreground">
        The log is the organizer history for the whole site. Lists on the other
        tabs follow the season selected above.
      </p>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No logged actions yet. Edits from Matches, Players, Schedule, and
          Predictions will appear here.
        </p>
      ) : (
        <div className="admin-table-scroll">
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead>When</EsportsTableHead>
                <EsportsTableHead>Who</EsportsTableHead>
                <EsportsTableHead>What</EsportsTableHead>
                <EsportsTableHead>Detail</EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {logs.map((row) => (
                <EsportsTableRow key={row.id}>
                  <EsportsTableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.createdAt)}
                  </EsportsTableCell>
                  <EsportsTableCell>
                    <div className="font-medium">{row.actorName}</div>
                    <div className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">
                      {row.actorDiscordId}
                    </div>
                  </EsportsTableCell>
                  <EsportsTableCell className="whitespace-nowrap font-medium text-primary">
                    {row.actionLabel}
                  </EsportsTableCell>
                  <EsportsTableCell className="max-w-[32rem] text-sm">
                    <span>{row.summary}</span>
                    {row.matchId ? (
                      <>
                        {" "}
                        <Link
                          href={`/admin/matches/${row.matchId}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Open match
                        </Link>
                      </>
                    ) : null}
                  </EsportsTableCell>
                </EsportsTableRow>
              ))}
            </EsportsTableBody>
          </EsportsTable>
        </div>
      )}
    </div>
  );
}
