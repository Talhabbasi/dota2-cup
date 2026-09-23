"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { MatchStatusBadge, type MatchStatus } from "@/components/common";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PlayoffMatchView } from "@/lib/playoff";

const SEED_NUM: Record<string, string> = {
  "Group A 1st": "#A1",
  "Group A 2nd": "#A2",
  "Group A 3rd": "#A3",
  "Group B 1st": "#B1",
  "Group B 2nd": "#B2",
  "Group B 3rd": "#B3",
  "Match 1 winner": "M1W",
  "Match 1 loser": "M1L",
  "Match 2 winner": "M2W",
  "Match 2 loser": "M2L",
  "Match 3 winner": "M3W",
  "Match 4 winner": "M4W",
  "Match 6 winner": "M6W",
  "Upper Final winner": "UFW",
  "Upper Final loser": "UFL",
  "Lower Final winner": "LFW",
};

function seedTag(label: string) {
  return SEED_NUM[label] ?? label.slice(0, 4).toUpperCase();
}

function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function slotScore(
  match: PlayoffMatchView,
  wins: number,
  gamesPlayed: boolean,
) {
  if (match.displayStatus === "completed" || gamesPlayed) return String(wins);
  if (match.displayStatus === "live") return "•";
  return "—";
}

function toStatus(match: PlayoffMatchView): MatchStatus {
  if (match.displayStatus === "live") return "live";
  if (match.displayStatus === "completed") return "completed";
  if (match.displayStatus === "upcoming") return "upcoming";
  return "upcoming";
}

function statusLabel(match: PlayoffMatchView): string {
  if (match.displayStatus === "live") return "LIVE";
  if (match.displayStatus === "completed") return "FT";
  if (match.displayStatus === "waiting") return "TBD";
  return "UPCOMING";
}

function TeamSlot({
  team,
  label,
  won,
  lost,
  score,
  tbd,
}: {
  team: { id: string; name: string } | null;
  label: string;
  won: boolean;
  lost: boolean;
  score: string;
  tbd: boolean;
}) {
  const name = team?.name ?? label;
  const seed = seedTag(label);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center gap-2 px-2.5",
        won && "bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.75)]",
        lost && "opacity-50",
        tbd && "bg-[#0a0d14]/40",
      )}
    >
      <Avatar
        className={cn(
          "size-7 shrink-0 bg-[#0a0d14] ring-1 after:border-white/10",
          won
            ? "ring-amber-400/70"
            : lost
              ? "ring-white/10"
              : "ring-white/15",
        )}
      >
        <AvatarFallback
          className={cn(
            "bg-transparent font-display text-[0.58rem] font-bold tracking-[0.1em]",
            won ? "text-white" : lost ? "text-slate-500" : "text-foreground",
          )}
        >
          {team ? monogram(team.name) : "·"}
        </AvatarFallback>
      </Avatar>

      <span
        className={cn(
          "w-8 shrink-0 font-mono text-[0.58rem] font-semibold tracking-wide text-slate-500 uppercase",
          won && "text-amber-400/90",
        )}
      >
        {seed}
      </span>

      {team ? (
        <Link
          href={`/teams/${team.id}`}
          title={name}
          className={cn(
            "min-w-0 flex-1 truncate text-[0.82rem] leading-none",
            won && "font-semibold text-white!",
            lost && "text-slate-500! line-through decoration-transparent",
            !won && !lost && "font-medium text-zinc-100!",
          )}
        >
          {name}
        </Link>
      ) : (
        <span
          title={name}
          className="min-w-0 flex-1 truncate text-[0.78rem] leading-none text-slate-500 italic"
        >
          {name}
        </span>
      )}

      <span
        className={cn(
          "shrink-0 font-mono text-sm font-bold tabular-nums",
          won && "text-white",
          lost && "text-slate-500",
          !won && !lost && score === "•" && "text-red-400",
          !won && !lost && score !== "•" && "text-slate-500",
        )}
      >
        {score}
      </span>
    </div>
  );
}

export const BRACKET_CARD_W = 256;
export const BRACKET_CARD_H = 112;

export function BracketNode({
  match,
  style,
  className,
  showcase = false,
}: {
  match: PlayoffMatchView;
  style?: CSSProperties;
  className?: string;
  /** Grand Final golden accent */
  showcase?: boolean;
}) {
  const completed = match.displayStatus === "completed";
  const live = match.displayStatus === "live";
  const waiting = match.displayStatus === "waiting";
  const winnerId = match.winner?.id ?? null;
  const loserId = match.loser?.id ?? null;
  const gamesPlayed = match.radiantWins + match.direWins > 0;
  const code = match.matchNumber != null ? `M${match.matchNumber}` : "GF";
  const radiantWon = Boolean(winnerId && match.radiant?.id === winnerId);
  const direWon = Boolean(winnerId && match.dire?.id === winnerId);
  const status = toStatus(match);

  return (
    <article
      style={style}
      data-slot={match.slotKey}
      aria-label={`${code} · ${match.round} · ${match.formatLabel}, ${match.displayStatus}`}
      className={cn(
        "flex h-full w-64 flex-col overflow-hidden rounded-xl border bg-[#121824] text-left shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        showcase &&
          "border-amber-500/70 shadow-[0_0_28px_rgba(245,158,11,0.28)]",
        !showcase && completed && "border-amber-500/50",
        !showcase && live && "border-red-500/60",
        !showcase && !completed && !live && "border-white/10",
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[0.62rem] font-semibold tracking-wide text-zinc-300 uppercase">
          {showcase ? (
            <Crown className="size-3 shrink-0 text-amber-400" aria-hidden />
          ) : null}
          <span className="truncate">
            {code} · {match.round} · {match.formatLabel}
          </span>
        </span>
        <MatchStatusBadge
          status={status}
          label={statusLabel(match)}
          className="shrink-0"
        />
      </header>

      <TeamSlot
        team={match.radiant}
        label={match.leftLabel}
        won={radiantWon}
        lost={Boolean(loserId && match.radiant?.id === loserId)}
        score={slotScore(match, match.radiantWins, gamesPlayed)}
        tbd={waiting && !match.radiant}
      />
      <div className="h-px shrink-0 bg-white/10" aria-hidden />
      <TeamSlot
        team={match.dire}
        label={match.rightLabel}
        won={direWon}
        lost={Boolean(loserId && match.dire?.id === loserId)}
        score={slotScore(match, match.direWins, gamesPlayed)}
        tbd={waiting && !match.dire}
      />
    </article>
  );
}
