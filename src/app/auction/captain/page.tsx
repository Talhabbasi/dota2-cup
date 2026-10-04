import { PageHeader } from "@/components/common";
import { CaptainAuctionClient } from "@/components/captain-auction-client";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Captain Auction Desk",
  `Captain-only bidding console for the ${CUP_NAME} auction.`,
);

export default async function CaptainAuctionPage() {
  const view = await getWebAuctionViewOrEmpty();
  return (
    <div className="page">
      <PageHeader
        eyebrow="Captains"
        title="Bid desk"
        subtitle="Use the login and passcode from Admin → Auction. Bidding validates purse and roster floor rules."
      />
      <CaptainAuctionClient initialView={view} />
    </div>
  );
}
