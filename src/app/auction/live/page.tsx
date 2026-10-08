import { PageHeader } from "@/components/common";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { livePageMeta } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta(
    "Live Auction",
    (brand) =>
      `Watch the live ${brand.name} player auction — current lot, bids, and purses.`,
  );
}

export default async function LiveAuctionPage() {
  const view = await getWebAuctionViewOrEmpty();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Auction"
        title="Live board"
        subtitle={
          <>
            Everyone can watch. Captains bid from the{" "}
            <Link href="/auction/captain" className="text-link">
              captain tab
            </Link>{" "}
            after signing in with Discord. Sold history stays on{" "}
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
