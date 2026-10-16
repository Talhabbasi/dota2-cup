import { PageHeader } from "@/components/common";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { livePageMeta } from "@/lib/seo";
import Link from "next/link";

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

  const view = await getWebAuctionViewOrEmpty();

  return (
    <div className="page auction-wide auction-live-page">
      <PageHeader
        eyebrow="Transfer market"
        title="Live auction"
        subtitle={
          <>
            IPL-style player auction for the cup.{" "}
            <Link href="/auction/captain" className="text-link">
              Captain desk
            </Link>{" "}
            ·{" "}
            <Link href="/auction/results" className="text-link">
              Results
            </Link>{" "}
            ·{" "}
            <Link href="/auction/queue" className="text-link">
              Queue
            </Link>
          </>
        }
      />
      <LiveAuctionBoard initial={view} />
    </div>
  );
}
