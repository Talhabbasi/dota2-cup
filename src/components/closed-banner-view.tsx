"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CUP_GAME, type CupGame } from "@/lib/games";
import { isHubPath, resolveChromeGame } from "@/lib/hub-game";

export type BannerPlan = {
  game: CupGame;
  label: string;
  line: string;
  open: boolean;
};

export function ClosedBannerView({
  dota,
  pubg,
  cookieGame,
  liveGame,
}: {
  dota: BannerPlan | null;
  pubg: BannerPlan | null;
  cookieGame: CupGame | null;
  liveGame: string | null;
}) {
  const pathname = usePathname();
  const hub = isHubPath(pathname);
  const game = hub
    ? liveGame === CUP_GAME.PUBG
      ? CUP_GAME.PUBG
      : CUP_GAME.DOTA
    : resolveChromeGame({ pathname, cookieGame, liveGame });
  const plan = game === CUP_GAME.PUBG ? pubg : dota;
  if (!plan) return null;

  return (
    <div className="relative z-30 border-b border-white/8 bg-[#080B12] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-center px-4 py-1.5">
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display text-[0.72rem] font-semibold tracking-[0.14em] text-[#F8FAFC] uppercase">
          <span className="inline-flex items-center gap-1.5 text-[#F5AE28]">
            <span
              className="size-1.5 rounded-full bg-[#36D6BF]"
              aria-hidden
            />
            {plan.label}
          </span>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <span className="tracking-normal text-muted-foreground normal-case">
            {plan.line}
          </span>
          <Link
            href={plan.open ? "/register" : "/seasons"}
            className="tracking-normal text-primary/90 normal-case underline-offset-2 hover:underline"
          >
            {plan.open ? "Register" : "Seasons"}
          </Link>
        </p>
      </div>
    </div>
  );
}
