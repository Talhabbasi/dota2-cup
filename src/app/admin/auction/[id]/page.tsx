import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { formatPoints } from "@/lib/constants";
import { adminGetSoldLot } from "@/lib/match-admin";
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
import { actionSetSoldPrice } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Lot", "Correct sold price.");

export default async function AdminAuctionLotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const lot = await adminGetSoldLot(id);
  if (!lot || lot.status !== "sold") notFound();

  return (
    <div className="page">
      <AdminBackLink href="/admin/auction" label="All sold lots" />
      <PageHeader
        eyebrow="Admin · Auction"
        title={lot.player.steamName}
        subtitle={`${lot.team?.name ?? "—"} · sold ${formatPoints(lot.soldPrice ?? 0)}`}
      />

      <AdminCard tone="accent" className="max-w-md">
        <AdminSection title="Correct price">
          <AdminConfirmForm
            action={actionSetSoldPrice}
            message={`Change sold price for ${lot.player.steamName}? Purse will adjust.`}
            className="grid gap-3"
          >
            <input type="hidden" name="lotId" value={lot.id} />
            <AdminField label="Sold price">
              <input
                name="soldPrice"
                type="number"
                min={0}
                step={100}
                required
                defaultValue={lot.soldPrice ?? 0}
                className={adminControlClass}
              />
            </AdminField>
            <p className="m-0 text-xs text-muted-foreground">
              Team purse adjusts by the difference from the previous price.
              Current purse: {formatPoints(lot.team?.purse ?? 0)}.
            </p>
            <AdminSubmitButton>
              Set price
            </AdminSubmitButton>
          </AdminConfirmForm>
        </AdminSection>
      </AdminCard>
    </div>
  );
}
