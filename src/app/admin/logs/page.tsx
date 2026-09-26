import { PageHeader } from "@/components/common";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";
import { requireAdmin } from "@/lib/admin-auth";
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

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await listAdminActivityLogs(150);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Activity logs"
        subtitle="Recent organizer actions with Discord id of who did it."
        pills={[{ value: logs.length, label: "shown" }]}
      />

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
                <EsportsTableHead>When (PKT)</EsportsTableHead>
                <EsportsTableHead>Admin</EsportsTableHead>
                <EsportsTableHead>Discord id</EsportsTableHead>
                <EsportsTableHead>Action</EsportsTableHead>
                <EsportsTableHead>Summary</EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {logs.map((row) => (
                <EsportsTableRow key={row.id}>
                  <EsportsTableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.createdAt)}
                  </EsportsTableCell>
                  <EsportsTableCell className="font-medium">
                    {row.actorName}
                  </EsportsTableCell>
                  <EsportsTableCell className="font-mono text-xs">
                    {row.actorDiscordId}
                  </EsportsTableCell>
                  <EsportsTableCell className="font-mono text-xs text-primary">
                    {row.action}
                  </EsportsTableCell>
                  <EsportsTableCell className="max-w-[28rem] text-sm">
                    {row.summary}
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
