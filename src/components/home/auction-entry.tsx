import Link from "next/link";
import { auctionPayBlockForPlayer } from "@/lib/auction-payment";
import { currentPlayer } from "@/lib/auth";

export async function AuctionEntry() {
  const { player } = await currentPlayer();
  const block = await auctionPayBlockForPlayer(player?.id);
  if (block.blocked && block.message) {
    return (
      <section className="mt-8">
        <div className="section-head row">
          <h2>Auction</h2>
        </div>
        <p className="mb-0 text-sm text-rose-200" role="alert">
          {block.message}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="section-head row">
        <h2>Auction</h2>
        <Link href="/auction" className="text-link">
          Open the board
        </Link>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Bidding stays on the auction board. Captains sign in there. Everyone else can watch.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/auction" className="btn">
          Watch live
        </Link>
        <Link href="/auction/captain" className="btn btn-gold">
          Captain desk
        </Link>
      </div>
    </section>
  );
}
