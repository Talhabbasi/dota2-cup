"use client";

import { AnimatePresence, motion } from "motion/react";
import { EsportsCard, TeamBadge } from "@/components/common";
import { displayTeamName } from "@/components/auction/team-purse-strip";
import { formatAuctionPoints } from "@/lib/auction-ui";
import { MAX_ROSTER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TeamRankings({
  teams,
  className,
}: {
  teams: { id: string; name: string; purse: number; rosterCount: number }[];
  className?: string;
}) {
  const ranked = [...teams].sort((a, b) => {
    if (b.rosterCount !== a.rosterCount) return b.rosterCount - a.rosterCount;
    if (a.purse !== b.purse) return a.purse - b.purse;
    return a.name.localeCompare(b.name);
  });

  return (
    <EsportsCard interactive={false} className={cn("overflow-hidden p-0", className)}>
      <header className="border-b border-primary/25 bg-primary/15 px-4 py-3">
        <h3 className="m-0 font-display text-sm tracking-[0.14em] text-primary uppercase">
          Team rankings
        </h3>
        <p className="mt-1 mb-0 text-[0.68rem] text-muted-foreground">
          Players signed · purse left — visible to everyone
        </p>
      </header>
      {ranked.length === 0 ? (
        <p className="m-0 px-4 py-5 text-sm text-muted-foreground">
          Rankings fill as teams buy players.
        </p>
      ) : (
        <ol className="m-0 list-none divide-y divide-white/5 p-0">
          <AnimatePresence initial={false}>
            {ranked.map((team, index) => (
              <motion.li
                key={team.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
              <TeamBadge
                name={displayTeamName(team.name)}
                size="sm"
                wrapName
                className="min-w-0 flex-1"
              />
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[0.7rem] tabular-nums text-foreground">
                    {formatAuctionPoints(team.purse)}
                    <span className="ml-1 text-[0.6rem] font-sans text-muted-foreground">
                      left
                    </span>
                  </span>
                  <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                    {team.rosterCount}/{MAX_ROSTER} players
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </EsportsCard>
  );
}
