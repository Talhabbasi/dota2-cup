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
  banner,
  children,
}: {
  seasonLabel: string;
  showRegister: boolean;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <>
      {!isAdmin ? banner : null}
      {!isAdmin ? (
        <Nav seasonLabel={seasonLabel} showRegister={showRegister} />
      ) : null}
      <main className="flex-1">{children}</main>
      {!isAdmin ? <SiteFooter seasonLabel={seasonLabel} /> : null}
    </>
  );
}
