import { MatchesScreen } from "@/app/matches/page";
import { CUP_GAME } from "@/lib/games";

export const revalidate = 30;

export default async function PubgMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  return <MatchesScreen searchParams={sp} game={CUP_GAME.PUBG} />;
}
