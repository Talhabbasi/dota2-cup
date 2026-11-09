import Link from "next/link";
import { PageHeader } from "@/components/common";
import { CUP_NAME, GAME_HOME_HREF } from "@/lib/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Fantasy",
  `Build a five-player fantasy roster for ${CUP_NAME}. Scoring and picks ship next.`,
);

export default function FantasyPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Dota 2"
        title="Fantasy"
        subtitle="Pick five from the auction, name an MVP, and climb a season leaderboard. Full roster builder and scoring land in the next build phase."
      />
      <div className="flex flex-wrap gap-3">
        <Link href={GAME_HOME_HREF.DOTA} className="btn btn-gold">
          Dota cup home
        </Link>
        <Link href="/predictions" className="btn">
          Predictions pick’em
        </Link>
      </div>
    </div>
  );
}
