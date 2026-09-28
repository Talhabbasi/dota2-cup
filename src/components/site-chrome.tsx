"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";
import { SeasonSwitcher } from "@/components/season-switcher";
import type { PublicSeasonRow } from "@/lib/seasons";

/**
 * Public chrome (top nav + footer). Hidden on /admin so the organizer shell stands alone.
 */
export function SiteChrome({
  seasonLabel,
  showRegister,
  showSeasons = false,
  seasons = [],
  liveSeasonId = null,
  banner,
  children,
}: {
  seasonLabel: string;
  showRegister: boolean;
  showSeasons?: boolean;
  seasons?: PublicSeasonRow[];
  liveSeasonId?: string | null;
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
          seasonSwitcher={
            showSeasons ? (
              <Suspense fallback={null}>
                <SeasonSwitcher
                  seasons={seasons}
                  currentSeasonId={liveSeasonId}
                />
              </Suspense>
            ) : null
          }
        />
      ) : null}
      <main className="flex-1">{children}</main>
      {!isAdmin ? <SiteFooter seasonLabel={seasonLabel} /> : null}
    </>
  );
}
