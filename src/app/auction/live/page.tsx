import { PageHeader } from "@/components/common";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { RegisterSignIn } from "@/components/register-signin";
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
    "Live Auction",
    (brand) =>
      `Watch the live ${brand.name} player auction — current lot, bids, and purses.`,
  );
}

export default async function LiveAuctionPage() {
  const session = await authSession();
  const [view, discordTeamId] = await Promise.all([
    getWebAuctionViewOrEmpty(),
    captainTeamIdForDiscord(session?.user?.discordId),
  ]);
  const teamId = session?.user?.isCaptainBidder
    ? (session.user.captainTeamId ?? null)
    : discordTeamId;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Auction"
        title="Live board"
        subtitle={
          <>
            Everyone can watch. Captains signed in with Discord bid here.
            Sold history stays on{" "}
            <Link href="/auction" className="text-link">
              /auction
            </Link>
            .
          </>
        }
      />
      {!session?.user ? (
        <div className="mb-4">
          <RegisterSignIn callbackUrl="/auction/live" />
        </div>
      ) : teamId ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Bidding as a captain. The button raises the current bid.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in, but this Discord account is not a captain for the
          live season, so this page stays watch-only.
        </p>
      )}
      <LiveAuctionBoard initial={view} canBid={Boolean(teamId)} teamId={teamId} />
    </div>
  );
}
