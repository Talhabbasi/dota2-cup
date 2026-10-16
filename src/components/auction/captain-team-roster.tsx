"use client";

import { AnimatePresence, motion } from "motion/react";
import { EsportsCard } from "@/components/common";
import { PlayerAvatar } from "@/components/auction/player-avatar";
import {
  formatAuctionPoints,
  primarySecondaryRoles,
} from "@/lib/auction-ui";
import { MAX_ROSTER } from "@/lib/constants";
import type { WebTeamPlayer } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

export function CaptainTeamRoster({
  teamName,
  purse,
  rosterCount,
  players,
  leading,
  className,
}: {
  teamName: string;
  purse: number;
  rosterCount: number;
  players: WebTeamPlayer[];
  leading?: boolean;
  className?: string;
}) {
  return (
    <EsportsCard
      interactive={false}
      className={cn(
        "overflow-hidden p-0",
        leading && "border-primary/35 bg-primary/5",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-4 py-3">
        <h3 className="m-0 font-display text-lg tracking-wide uppercase">
          Your team · {teamName}
        </h3>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-primary">
            {formatAuctionPoints(purse)}
          </span>{" "}
          left · {rosterCount}/{MAX_ROSTER} players
        </span>
      </header>

      {players.length === 0 ? (
        <p className="m-0 px-4 py-6 text-sm text-muted-foreground">
          No players on this roster yet.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-3">
          <AnimatePresence initial={false}>
            {players.map((p, index) => {
              const { primary, secondary } = primarySecondaryRoles(p.rolesJson);
              const roleLine =
                [primary, secondary].filter(Boolean).join(" · ") ||
                (p.captain ? "Captain" : "Flex");
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -10, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.04, 0.2),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-white/8 bg-black/25 px-3 py-2.5",
                    p.captain && "border-primary/25 bg-primary/5",
                  )}
                >
                  <PlayerAvatar
                    name={p.name}
                    imageUrl={p.imageUrl}
                    size="sm"
                    square
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-semibold leading-snug break-words tracking-wide">
                      {p.name}
                      {p.captain ? (
                        <span className="ml-1.5 text-[0.65rem] font-semibold tracking-[0.12em] text-primary uppercase">
                          Captain
                        </span>
                      ) : null}
                    </p>
                    <p className="m-0 text-[0.68rem] leading-snug break-words tracking-wide text-muted-foreground uppercase">
                      {roleLine}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.price != null ? (
                      <motion.p
                        key={p.price}
                        initial={{ scale: 1.12, color: "rgb(252 211 77)" }}
                        animate={{ scale: 1, color: "rgb(253 230 138)" }}
                        transition={{ duration: 0.45 }}
                        className="m-0 font-mono text-sm font-bold tabular-nums text-amber-200"
                      >
                        {formatAuctionPoints(p.price)}
                        <span className="ml-0.5 text-[0.6rem] font-sans font-normal text-muted-foreground">
                          pts
                        </span>
                      </motion.p>
                    ) : (
                      <p className="m-0 font-mono text-xs text-muted-foreground">
                        {p.captain ? "—" : "assigned"}
                      </p>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </EsportsCard>
  );
}
