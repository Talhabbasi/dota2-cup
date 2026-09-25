import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { playerMustPay } from "@/lib/payments";
import { entryFeePkr, formatEntryFee } from "@/lib/registration-status";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminSection,
  AdminStatus,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { actionClearPaid, actionMarkPaid } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Payment", "Mark or clear payment.");

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: { team: { select: { name: true } } },
  });
  if (!player) notFound();

  const fee = entryFeePkr();
  const mustPay = playerMustPay(player.rosterRole);
  const paid = Boolean(player.paidAt);
  const amount = paid ? player.paymentAmount || fee : fee;

  return (
    <div className="page">
      <AdminBackLink href="/admin/payments" label="All payments" />
      <PageHeader
        eyebrow="Admin · Payment"
        title={player.steamName}
        subtitle={player.team?.name ?? "Unsigned"}
        pills={[
          {
            label: player.isCaptain
              ? "captain"
              : player.rosterRole === "sub"
                ? "sub"
                : "starter",
          },
          {
            label: !mustPay ? "free" : paid ? "paid" : "unpaid",
          },
        ]}
      />

      <AdminCard tone="accent" className="max-w-md">
        <AdminSection title="Payment">
          {!mustPay ? (
            <p className="m-0 text-sm text-muted-foreground">
              Substitutes do not pay ({formatEntryFee()} is for starters only).
            </p>
          ) : paid ? (
            <div className="grid gap-3">
              <p className="m-0 text-sm">
                Marked{" "}
                <AdminStatus tone="ok">paid</AdminStatus> for{" "}
                <strong className="text-emerald-300">
                  Rs {amount.toLocaleString("en-PK")}
                </strong>
                {player.paidAt
                  ? ` on ${player.paidAt.toLocaleDateString("en-PK")}`
                  : ""}
                .
              </p>
              <AdminConfirmForm
                action={actionClearPaid}
                message={`Clear payment for ${player.steamName}?`}
              >
                <input type="hidden" name="discordId" value={player.discordId} />
                <AdminSubmitButton
                  variant="secondary" className="text-xs"
                  pendingLabel="Clearing…"
                >
                  Clear payment
                </AdminSubmitButton>
              </AdminConfirmForm>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="m-0 text-sm text-muted-foreground">
                Owes{" "}
                <strong className="text-foreground">
                  Rs {amount.toLocaleString("en-PK")}
                </strong>{" "}
                ({formatEntryFee()}).
              </p>
              <AdminConfirmForm
                action={actionMarkPaid}
                message={`Mark ${player.steamName} as paid (Rs ${amount.toLocaleString("en-PK")})?`}
              >
                <input type="hidden" name="discordId" value={player.discordId} />
                <AdminSubmitButton
                >
                  Mark paid
                </AdminSubmitButton>
              </AdminConfirmForm>
            </div>
          )}
        </AdminSection>
      </AdminCard>
    </div>
  );
}
