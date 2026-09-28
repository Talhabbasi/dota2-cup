"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * Public chrome (top nav + footer). Hidden on /admin so the organizer shell stands alone.
 * Season switcher lives on the home hero only — not in the nav.
 */
export function SiteChrome({
  seasonLabel,
  showRegister,
  showSeasons = false,
  viewSeasonNumber = null,
  banner,
  children,
}: {
  seasonLabel: string;
  showRegister: boolean;
  showSeasons?: boolean;
  viewSeasonNumber?: number | null;
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
          viewSeasonNumber={viewSeasonNumber}
        />
      ) : null}
      <main className="flex-1">{children}</main>
      {!isAdmin ? <SiteFooter seasonLabel={seasonLabel} /> : null}
    </>
  );
}
