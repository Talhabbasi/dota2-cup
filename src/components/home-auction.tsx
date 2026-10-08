import Link from "next/link";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import { getWebAuctionViewOrEmpty } from "@/lib/web-auction";

export async function HomeAuction() {
  const view = await getWebAuctionViewOrEmpty();

  return (
    <section className="mt-8">
      <div className="section-head row">
        <h2>Live auction</h2>
        <Link href="/auction/live" className="text-link">
          Full board
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Anyone can watch. Captains bid from the{" "}
        <Link href="/auction/captain" className="text-link">
          captain tab
        </Link>{" "}
        after signing in with Discord.
      </p>
      <LiveAuctionBoard initial={view} />
    </section>
  );
}
