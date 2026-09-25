import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import {
  adminListPaymentPlayers,
  getPaymentCollection,
  listTeamPayments,
} from "@/lib/payments";
import { entryFeePkr, formatEntryFee } from "@/lib/registration-status";
import { pageMeta } from "@/lib/seo";
import { AdminPaymentsBoard } from "@/components/admin/payments-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Payments",
  "Entry fee collection and team payment status.",
);

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const [summary, players, teams] = await Promise.all([
    getPaymentCollection(),
    adminListPaymentPlayers(),
    listTeamPayments(),
  ]);
  const fee = entryFeePkr();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Payments"
        subtitle={`Collection desk — ${formatEntryFee()} per starter. Subs free. Mark paid when verified.`}
        pills={[
          {
            value: `Rs ${summary.collected.toLocaleString("en-PK")}`,
            label: "in",
          },
          { value: summary.unpaidCount, label: "owe" },
        ]}
      />
      <AdminPaymentsBoard
        summary={{
          collected: summary.collected,
          owed: summary.owed,
          expected: summary.expected,
          paidCount: summary.paidCount,
          unpaidCount: summary.unpaidCount,
          teamsAllowed: summary.teamsAllowed,
          teamCount: summary.teamCount,
        }}
        players={players.map((p) => ({
          id: p.id,
          discordId: p.discordId,
          steamName: p.steamName,
          teamName: p.teamName,
          mustPay: p.mustPay,
          paid: p.paid,
          amount: p.amount || fee,
          paidAtLabel: p.paidAtLabel,
          slot: p.isCaptain
            ? "captain"
            : p.rosterRole === "sub"
              ? "sub"
              : p.mustPay
                ? "starter"
                : "free",
        }))}
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          paidPkr: t.paidPkr,
          requiredPkr: t.requiredPkr,
          allowed: t.allowed,
          unpaidNames: t.unpaid.map((u) => u.steamName),
          starters: t.starters,
          subs: t.subs,
        }))}
      />
    </div>
  );
}
