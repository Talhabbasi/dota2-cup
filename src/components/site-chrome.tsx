"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * Public chrome (top nav + footer). Hidden on /admin so the organizer shell stands alone.
 */
export function SiteChrome({
  seasonLabel,
  showRegister,
  showSeasons = false,
  game = "DOTA",
  auctionHref = "/auction",
  banner,
  children,
}: {
  seasonLabel: string;
  showRegister: boolean;
  showSeasons?: boolean;
  game?: string;
  /** Captains → /auction/captain; registered players → /auction; null hides Auction. */
  auctionHref?: string | null;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <>
      {!isAdmin ? banner : null}
      {!isAdmin ? (
        <Nav
          seasonLabel={seasonLabel}
          showRegister={showRegister}
          showSeasons={showSeasons}
          game={game}
          auctionHref={auctionHref}
        />
      ) : null}
      <main className="flex-1">{children}</main>
      {!isAdmin ? <SiteFooter seasonLabel={seasonLabel} game={game} /> : null}
    </>
  );
}
