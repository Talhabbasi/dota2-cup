import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { prisma } from "@/lib/prisma";
import { playerMustPay } from "@/lib/payments";
import { entryFeePkr, formatEntryFee } from "@/lib/registration-status";
import { pageMeta } from "@/lib/seo";
import {
  AdminBackLink,
  AdminCard,
  AdminOutsideSeason,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const { view, readOnly } = await resolveAdminSeasonView(sp.season);
  const backHref = `/admin/payments?season=${view.id}`;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) notFound();
  const membership = await prisma.seasonPlayer.findUnique({
    where: { seasonId_playerId: { seasonId: view.id, playerId: player.id } },
    include: { team: { select: { name: true } } },
  });
  if (!membership) {
    return <AdminOutsideSeason href={backHref} label="All payments" />;
  }

  const fee = entryFeePkr();
  const mustPay = playerMustPay(membership.rosterRole);
  const paid = Boolean(membership.paidAt);
  const amount = paid ? membership.paymentAmount || fee : fee;

  return (
    <div className="page">
      <AdminBackLink href={backHref} label="All payments" />
      <PageHeader
        eyebrow="Admin · Payment"
        title={player.steamName}
        subtitle={membership.team?.name ?? "Unsigned"}
        pills={[
          {
            label: membership.isCaptain
              ? "captain"
              : membership.rosterRole === "sub"
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
          {readOnly ? (
            <p className="m-0 text-sm text-muted-foreground">
              {membership.team?.name ?? "Unsigned"} ·{" "}
              {!mustPay
                ? "No fee for this slot."
                : paid
                  ? `Paid Rs ${amount.toLocaleString("en-PK")}.`
                  : `Owes Rs ${amount.toLocaleString("en-PK")}.`}{" "}
              This season is read-only.
            </p>
          ) : !mustPay ? (
            <p className="m-0 text-sm text-muted-foreground">
              Substitutes do not pay ({formatEntryFee()} is for starters only).
            </p>
          ) : paid ? (
            <div className="grid gap-3">
              <p className="m-0 text-sm">
                Marked <AdminStatus tone="ok">paid</AdminStatus> for{" "}
                <strong className="text-emerald-300">
                  Rs {amount.toLocaleString("en-PK")}
                </strong>
                {membership.paidAt
                  ? ` on ${membership.paidAt.toLocaleDateString("en-PK")}`
                  : ""}
                .
              </p>
              <AdminConfirmForm
                action={actionClearPaid}
                message={`Clear payment for ${player.steamName}?`}
              >
                <input type="hidden" name="discordId" value={player.discordId} />
                <input type="hidden" name="seasonId" value={view.id} />
                <AdminSubmitButton
                  variant="secondary"
                  className="text-xs"
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
                <input type="hidden" name="seasonId" value={view.id} />
                <AdminSubmitButton>Mark paid</AdminSubmitButton>
              </AdminConfirmForm>
            </div>
          )}
        </AdminSection>
      </AdminCard>
    </div>
  );
}
