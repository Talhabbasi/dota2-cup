"use client";

import { useSession } from "next-auth/react";
import { RegisterSignIn } from "@/components/register-signin";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import type { WebAuctionView } from "@/lib/web-auction";

export function CaptainAuctionClient({
  initialView,
  discordTeamId = null,
}: {
  initialView: WebAuctionView;
  discordTeamId?: string | null;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!session?.user?.discordId) {
    return (
      <div className="mx-auto grid max-w-sm gap-4">
        <RegisterSignIn callbackUrl="/auction/captain" />
        <p className="m-0 text-center text-xs text-muted-foreground">
          Captains bid with the Discord account appointed as captain.
        </p>
      </div>
    );
  }

  if (!discordTeamId) {
    return (
      <div className="grid gap-4">
        <p className="m-0 text-sm text-muted-foreground">
          Signed in as <strong>{session.user.name}</strong>, but this Discord
          account is not a captain this season. You can watch the auction below.
        </p>
        <LiveAuctionBoard initial={initialView} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-sm">
        Bidding as <strong>{session.user.name}</strong> with Discord.
      </p>
      <LiveAuctionBoard initial={initialView} canBid teamId={discordTeamId} />
    </div>
  );
}
