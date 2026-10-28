import { AuctionPayWall, auctionViewerBlock } from "@/components/auction-pay-wall";
import { PageHeader } from "@/components/common";
import { CaptainAuctionClient } from "@/components/captain-auction-client";
import { authSession } from "@/lib/auth";
import {
  captainTeamIdForDiscord,
  getWebAuctionViewOrEmpty,
} from "@/lib/web-auction";
import { livePageMeta } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta(
    "Captain Auction Desk",
    (brand) => `Captain-only bidding console for the ${brand.name} auction.`,
  );
}

export default async function CaptainAuctionPage() {
  const block = await auctionViewerBlock();
  if (block.blocked && block.message) {
    return <AuctionPayWall message={block.message} />;
  }

  const session = await authSession();
  const [view, discordTeamId] = await Promise.all([
    getWebAuctionViewOrEmpty(),
    captainTeamIdForDiscord(session?.user?.discordId),
  ]);

  return (
    <div className="page auction-wide">
      <PageHeader
        eyebrow="Captains"
        title="Bid desk"
        subtitle={
          <>
            Sign in with the Discord account appointed as captain to bid and see
            your team. Bidding checks purse and roster size.{" "}
            <Link href="/auction" className="text-link">
              Live board
            </Link>
          </>
        }
      />
      <CaptainAuctionClient
        initialView={view}
        discordTeamId={discordTeamId}
      />
    </div>
  );
}
