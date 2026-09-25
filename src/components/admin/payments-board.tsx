"use client";

import { AdminDataTable } from "@/components/admin/master-detail";
import {
  AdminCard,
  AdminStatus,
  AdminToolbar,
} from "@/components/admin/ui";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";

export type PaymentPlayerRow = {
  id: string;
  discordId: string;
  steamName: string;
  teamName: string | null;
  mustPay: boolean;
  paid: boolean;
  amount: number;
  paidAtLabel: string | null;
  slot: string;
};

export type PaymentTeamRow = {
  id: string;
  name: string;
  paidPkr: number;
  requiredPkr: number;
  allowed: boolean;
  unpaidNames: string[];
  starters: number;
  subs: number;
};

function pkr(n: number) {
  return `Rs ${n.toLocaleString("en-PK")}`;
}

export function AdminPaymentsBoard({
  summary,
  players,
  teams,
}: {
  summary: {
    collected: number;
    owed: number;
    expected: number;
    paidCount: number;
    unpaidCount: number;
    teamsAllowed: number;
    teamCount: number;
  };
  players: PaymentPlayerRow[];
  teams: PaymentTeamRow[];
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Collected",
            value: pkr(summary.collected),
            tone: "text-emerald-300",
          },
          {
            label: "Still owed",
            value: pkr(summary.owed),
            tone: "text-rose-300",
          },
          {
            label: "Expected",
            value: pkr(summary.expected),
            tone: "text-primary",
          },
          {
            label: "Teams clear",
            value: `${summary.teamsAllowed}/${summary.teamCount}`,
            tone: "text-foreground",
          },
        ].map((card) => (
          <AdminCard key={card.label}>
            <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {card.label}
            </p>
            <p
              className={`mt-2 mb-0 text-2xl font-semibold tracking-wide ${card.tone}`}
            >
              {card.value}
            </p>
          </AdminCard>
        ))}
      </div>

      <div>
        <AdminToolbar
          title="By team"
          count={teams.length}
          hint={`${summary.paidCount} paid · ${summary.unpaidCount} unpaid starters`}
        />
        <div className="admin-table-scroll">
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead>Team</EsportsTableHead>
                <EsportsTableHead>Paid</EsportsTableHead>
                <EsportsTableHead>Required</EsportsTableHead>
                <EsportsTableHead>Roster</EsportsTableHead>
                <EsportsTableHead>Status</EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {teams.map((t) => (
                <EsportsTableRow key={t.id}>
                  <EsportsTableCell className="font-medium">{t.name}</EsportsTableCell>
                  <EsportsTableCell className="tabular-nums">
                    {pkr(t.paidPkr)}
                  </EsportsTableCell>
                  <EsportsTableCell className="tabular-nums text-muted-foreground">
                    {pkr(t.requiredPkr)}
                  </EsportsTableCell>
                  <EsportsTableCell className="text-muted-foreground">
                    {t.starters} starters · {t.subs} subs
                  </EsportsTableCell>
                  <EsportsTableCell>
                    <AdminStatus tone={t.allowed ? "ok" : "warn"}>
                      {t.allowed
                        ? "clear"
                        : t.unpaidNames.length
                          ? `${t.unpaidNames.length} owe`
                          : "short/over"}
                    </AdminStatus>
                  </EsportsTableCell>
                </EsportsTableRow>
              ))}
            </EsportsTableBody>
          </EsportsTable>
        </div>
      </div>

      <AdminDataTable
        title="Players"
        hint="Click a player to mark or clear payment."
        items={players}
        getId={(p) => p.id}
        hrefFor={(p) => `/admin/payments/${p.id}`}
        searchPlaceholder="Search name or team…"
        searchText={(p) => `${p.steamName} ${p.teamName ?? ""} ${p.slot}`}
        emptyLabel="No players to track."
        filters={[
          {
            key: "status",
            label: "Payment",
            options: [
              { value: "paid", label: "Paid" },
              { value: "unpaid", label: "Unpaid" },
              { value: "free", label: "Sub · free" },
            ],
            match: (p, value) => {
              if (value === "free") return !p.mustPay;
              if (value === "paid") return p.mustPay && p.paid;
              if (value === "unpaid") return p.mustPay && !p.paid;
              return true;
            },
          },
          {
            key: "slot",
            label: "Slot",
            options: [
              { value: "captain", label: "Captain" },
              { value: "starter", label: "Starter" },
              { value: "sub", label: "Substitute" },
            ],
            match: (p, value) => p.slot === value,
          },
          {
            key: "team",
            label: "Team",
            options: [
              { value: "__unsigned__", label: "Unsigned" },
              ...[
                ...new Set(
                  players.map((p) => p.teamName).filter(Boolean) as string[],
                ),
              ]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => ({ value: name, label: name })),
            ],
            match: (p, value) =>
              value === "__unsigned__" ? !p.teamName : p.teamName === value,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "Player",
            cell: (p) => <span className="font-medium">{p.steamName}</span>,
          },
          {
            key: "team",
            header: "Team",
            cell: (p) => p.teamName ?? "Unsigned",
          },
          {
            key: "slot",
            header: "Slot",
            cell: (p) => (
              <AdminStatus
                tone={
                  p.slot === "sub"
                    ? "neutral"
                    : p.paid
                      ? "ok"
                      : p.mustPay
                        ? "warn"
                        : "neutral"
                }
              >
                {p.slot}
              </AdminStatus>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            cell: (p) => (
              <span className="tabular-nums">
                {p.mustPay || p.paid ? pkr(p.amount) : "Free"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (p) =>
              !p.mustPay ? (
                <AdminStatus tone="neutral">sub · free</AdminStatus>
              ) : p.paid ? (
                <AdminStatus tone="ok">paid {p.paidAtLabel}</AdminStatus>
              ) : (
                <AdminStatus tone="danger">unpaid</AdminStatus>
              ),
          },
        ]}
      />
    </div>
  );
}
