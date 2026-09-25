import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListSoldLots } from "@/lib/match-admin";
import { pageMeta } from "@/lib/seo";
import { AdminAuctionBoard } from "@/components/admin/auction-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Auction", "Fix sold lot prices.");

export default async function AdminAuctionPage() {
  await requireAdmin();
  const lots = await adminListSoldLots();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Auction"
        subtitle="Sold lots table — click a row to correct the price."
        pills={[{ value: lots.length, label: "sold" }]}
      />
      <AdminAuctionBoard
        lots={lots.map((lot) => ({
          id: lot.id,
          playerName: lot.player.steamName,
          teamName: lot.team?.name ?? "—",
          soldPrice: lot.soldPrice ?? 0,
          purse: lot.team?.purse ?? 0,
        }))}
      />
    </div>
  );
}
