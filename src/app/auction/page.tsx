import { AuctionPayWall, auctionViewerBlock } from "@/components/auction-pay-wall";
import { PageHeader } from "@/components/common";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { livePageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta(
    "Player Auction",
    (brand) =>
      `Watch the live ${brand.name} player auction — current lot, bids, and purses.`,
  );
}

export default async function AuctionLivePage() {
  const { auctionEnabled } = await getCupFeatureSettings();
  if (!auctionEnabled) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Auction"
          title="Auction"
          subtitle="This cup assigns players without an auction."
        />
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            Auction is off. Admins add players to teams directly. Turn it on with{" "}
            <code>/cup auction mode:on</code>.
          </p>
        </div>
      </div>
    );
  }

  const block = await auctionViewerBlock();
  if (block.blocked && block.message) {
    return <AuctionPayWall message={block.message} />;
  }

  const view = await getWebAuctionViewOrEmpty();

  return (
    <div className="page auction-wide auction-live-page">
      <PageHeader eyebrow="Transfer market" title="Live auction" />
      <LiveAuctionBoard initial={view} />
    </div>
  );
}
