import { ClosedBannerView, type BannerPlan } from "@/components/closed-banner-view";
import { CUP_GAME, type CupGame } from "@/lib/games";
import { readHubGameCookie } from "@/lib/hub-game-server";
import { SEASON_STATUS, seasonPlanLine } from "@/lib/season-constants";
import { getFeaturedSeasonForGame, getLiveSeason, type PublicSeasonRow } from "@/lib/seasons";

function toPlan(game: CupGame, season: PublicSeasonRow | null): BannerPlan | null {
  if (!season) return null;
  const line = seasonPlanLine({
    number: season.number,
    teamCount: season.teamCount,
    plannedStartAt: season.plannedStartAt,
    startedAt: season.startedAt,
    phase: season.phase,
  });
  const open = season.status !== SEASON_STATUS.archived;
  return {
    game,
    label: game === CUP_GAME.PUBG ? "PUBG" : "Dota",
    line: open ? line : `${line} · complete`,
    open,
  };
}

/**
 * Top strip follows the tournament you are in, not whichever season is globally live.
 */
export async function ClosedBanner() {
  const [live, cookieGame, dota, pubg] = await Promise.all([
    getLiveSeason(),
    readHubGameCookie(),
    getFeaturedSeasonForGame(CUP_GAME.DOTA),
    getFeaturedSeasonForGame(CUP_GAME.PUBG),
  ]);

  return (
    <ClosedBannerView
      dota={toPlan(CUP_GAME.DOTA, dota.season)}
      pubg={toPlan(CUP_GAME.PUBG, pubg.season)}
      cookieGame={cookieGame}
      liveGame={live?.game ?? null}
    />
  );
}
