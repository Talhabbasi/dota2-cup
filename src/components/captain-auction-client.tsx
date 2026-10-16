"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { RegisterSignIn } from "@/components/register-signin";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { EsportsCard } from "@/components/common";
import type { WebAuctionView } from "@/lib/web-auction";
import type { AuctionBidHistoryItem } from "@/lib/auction-ui";

export function CaptainAuctionClient({
  initialView,
  discordTeamId = null,
  seedBids,
}: {
  initialView: WebAuctionView;
  discordTeamId?: string | null;
  seedBids?: AuctionBidHistoryItem[];
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <EsportsCard interactive={false} className="p-6">
        <p className="m-0 text-sm text-muted-foreground">Loading captain desk…</p>
      </EsportsCard>
    );
  }

  if (!session?.user?.discordId) {
    return (
      <div className="mx-auto grid max-w-md gap-4">
        <EsportsCard interactive={false} className="p-5">
          <p className="m-0 text-center font-display text-lg tracking-wide uppercase">
            Captain sign-in
          </p>
          <p className="mt-2 mb-4 text-center text-sm text-muted-foreground">
            Sign in with Discord as the appointed captain to bid.
          </p>
          <div className="flex justify-center">
            <RegisterSignIn callbackUrl="/auction/captain" />
          </div>
        </EsportsCard>
        <p className="m-0 text-center text-xs text-muted-foreground">
          Spectators can watch the{" "}
          <Link href="/auction" className="text-link">
            live board
          </Link>{" "}
          without signing in.
        </p>
      </div>
    );
  }

  if (!discordTeamId) {
    return (
      <div className="grid gap-4">
        <EsportsCard interactive={false} className="border-amber-500/25 bg-amber-500/5 p-4">
          <p className="m-0 text-sm">
            Signed in as <strong>{session.user.name}</strong>, but this Discord
            account is not a captain this season. You can watch below — bidding
            stays locked.
          </p>
        </EsportsCard>
        <LiveAuctionBoard initial={initialView} seedBids={seedBids} />
      </div>
    );
  }

  return (
    <LiveAuctionBoard
      initial={initialView}
      canBid
      teamId={discordTeamId}
      seedBids={seedBids}
    />
  );
}
