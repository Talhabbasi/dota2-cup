import Link from "next/link";
import { AuctionPayWall, auctionViewerBlock } from "@/components/auction-pay-wall";
import { PageHeader } from "@/components/common";
import { AuctionQueueClient } from "@/components/auction/auction-queue-client";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { livePageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta(
    "Auction Queue",
    (brand) =>
      `Upcoming and completed lots for the ${brand.name} player auction.`,
  );
}

export default async function AuctionQueuePage() {
  const block = await auctionViewerBlock();
  if (block.blocked && block.message) {
    return <AuctionPayWall message={block.message} />;
  }

  const view = await getWebAuctionViewOrEmpty();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Auction"
        title="Player queue"
        subtitle={
          <>
            Current lot, upcoming pool, and the last completed player.{" "}
            <Link href="/auction" className="text-link">
              Live board
            </Link>
          </>
        }
      />
      <AuctionQueueClient initial={view} />
    </div>
  );
}
