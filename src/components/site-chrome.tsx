"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";
import { CUP_GAME, type CupGame } from "@/lib/games";
import { isHubPath, pathLocksGame, resolveChromeGame } from "@/lib/hub-game";

/**
 * Public chrome (top nav + footer). Hidden on /admin so the organizer shell stands alone.
 * Game branding follows the page you are on, then the game you last entered.
 */
export function SiteChrome({
  seasonLabel,
  dotaSeasonLabel,
  pubgSeasonLabel,
  showRegister,
  showSeasons = false,
  cookieGame = null,
  liveGame = null,
  auctionHref = "/auction",
  banner,
  children,
}: {
  seasonLabel: string;
  dotaSeasonLabel: string;
  pubgSeasonLabel: string;
  showRegister: boolean;
  showSeasons?: boolean;
  cookieGame?: CupGame | null;
  liveGame?: string | null;
  /** Captains → /auction/captain; registered players → /auction; null hides Auction. */
  auctionHref?: string | null;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const hubMode = isHubPath(pathname);
  const [chosen, setChosen] = useState<CupGame | null>(cookieGame);
  const locked = pathLocksGame(pathname);
  if (locked && locked !== chosen) {
    setChosen(locked);
  }
  const game = resolveChromeGame({
    pathname,
    cookieGame: locked ?? chosen ?? cookieGame,
    liveGame,
  });

  useEffect(() => {
    document.documentElement.dataset.game = game === CUP_GAME.PUBG ? "pubg" : "dota";
  }, [game]);

  const activeSeasonLabel =
    game === CUP_GAME.PUBG ? pubgSeasonLabel : dotaSeasonLabel;

  return (
    <>
      {!isAdmin ? banner : null}
      {!isAdmin ? (
        <Nav
          seasonLabel={hubMode ? seasonLabel : activeSeasonLabel}
          showRegister={showRegister}
          showSeasons={showSeasons}
          game={game}
          auctionHref={hubMode ? null : auctionHref}
          hubMode={hubMode}
        />
      ) : null}
      <main className="flex-1">{children}</main>
      {!isAdmin ? (
        <SiteFooter
          seasonLabel={hubMode ? seasonLabel : activeSeasonLabel}
          game={game}
          hubMode={hubMode}
        />
      ) : null}
    </>
  );
}
