import { PageHeader } from "@/components/common";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Live Auction",
  `Watch the live ${CUP_NAME} player auction — current lot, bids, and purses.`,
);

export default async function LiveAuctionPage() {
  const view = await getWebAuctionViewOrEmpty();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Auction"
        title="Live board"
        subtitle={
          <>
            Spectator view. Captains bid at{" "}
            <Link href="/auction/captain" className="text-link">
              /auction/captain
            </Link>
            . Sold history stays on{" "}
            <Link href="/auction" className="text-link">
              /auction
            </Link>
            .
          </>
        }
      />
      <LiveAuctionBoard initial={view} />
    </div>
  );
}
