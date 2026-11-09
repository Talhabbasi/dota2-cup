import { HubHome } from "@/components/hub/hub-home";
import type { ChampionSlide } from "@/components/hub/champion-slider";
import { CUP_GAME } from "@/lib/games";
import { HUB_DESCRIPTION, HUB_NAME, HUB_TITLE_SUFFIX } from "@/lib/brand";
import { loadHubOverview } from "@/lib/hub-overview";
import { championRosterArt } from "@/lib/season-champion-art";
import { getFeaturedSeasonForGame, getSeasonHistory } from "@/lib/seasons";
import type { Metadata } from "next";

export const revalidate = 30;

export const metadata: Metadata = {
  title: {
    absolute: `${HUB_NAME} | ${HUB_TITLE_SUFFIX}`,
  },
  description: HUB_DESCRIPTION,
};

export default async function HubPage() {
  const [dota, pubg, overview, history] = await Promise.all([
    getFeaturedSeasonForGame(CUP_GAME.DOTA),
    getFeaturedSeasonForGame(CUP_GAME.PUBG),
    loadHubOverview(),
    getSeasonHistory(),
  ]);

  const champions: ChampionSlide[] = history
    .filter((season) => season.game === CUP_GAME.DOTA)
    .sort((a, b) => b.number - a.number)
    .flatMap((season) => {
      const art = championRosterArt(season.game, season.number);
      if (!art || !season.champion) return [];
      const captain = season.champion.players.find(
        (player) => player.isCaptain && !player.isSub,
      );
      return [{
        id: season.id,
        href: `/seasons/dota-${season.number}`,
        image: art.src,
        alt: art.alt,
        label: `Dota Season ${season.number}`,
        team: season.champion.name,
        player: captain?.steamName ?? null,
      }];
    });

  return <HubHome dota={dota} pubg={pubg} overview={overview} champions={champions} />;
}
