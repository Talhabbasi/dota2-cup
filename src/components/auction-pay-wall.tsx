import { PageHeader } from "@/components/common";
import { currentPlayer } from "@/lib/auth";
import { auctionPayBlockForPlayer } from "@/lib/auction-payment";

export async function auctionViewerBlock() {
  const { player } = await currentPlayer();
  return auctionPayBlockForPlayer(player?.id ?? null);
}

export function AuctionPayWall({ message }: { message: string }) {
  return (
    <div className="page">
      <PageHeader eyebrow="Auction" title="Entry unpaid" subtitle={message} />
      <div className="empty-panel teams-list-empty">
        <p className="muted" role="alert" style={{ margin: 0 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
