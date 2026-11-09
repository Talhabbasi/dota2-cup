import { TeamsScreen } from "@/app/teams/page";
import { CUP_GAME } from "@/lib/games";

export const revalidate = 30;

export default async function DotaTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  return <TeamsScreen searchParams={sp} game={CUP_GAME.DOTA} />;
}
