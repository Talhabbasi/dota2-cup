"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crown } from "lucide-react";
import { formatScheduleWhen } from "@/lib/schedule";
import type { PlayoffMatchView, PlayoffView } from "@/lib/playoff";
import {
  BracketNode,
  BRACKET_CARD_H,
  BRACKET_CARD_W,
} from "@/components/bracket-node";
import { cn } from "@/lib/utils";

export type GroupGraphMatch = {
  id: string;
  group: "A" | "B";
  radiant: { id: string; name: string };
  dire: { id: string; name: string };
  scheduledAt: Date | string;
  status: string;
  winnerName?: string | null;
};

const CARD_W = BRACKET_CARD_W;
const CARD_H = BRACKET_CARD_H;
const GAP_Y = 20;
const JOIN = 44;
const LABEL_H = 32;
const TIER_GAP = 40;
const SECTION_PAD = 12;

type Box = { x: number; y: number };
type ViewFocus = "all" | "upper" | "lower" | "grand";

function pick(matches: PlayoffMatchView[], slot: PlayoffMatchView["slotKey"]) {
  return matches.find((match) => match.slotKey === slot);
}

function midY(box: Box) {
  return box.y + CARD_H / 2;
}

function forkPath(top: Box, bottom: Box, target: Box) {
  const y1 = midY(top);
  const y2 = midY(bottom);
  const mid = (y1 + y2) / 2;
  const xEdge = top.x + CARD_W;
  const spine = xEdge + JOIN / 2;
  return `M ${xEdge} ${y1} H ${spine} V ${y2} H ${xEdge} M ${spine} ${mid} H ${target.x}`;
}

function linePath(from: Box, to: Box) {
  return `M ${from.x + CARD_W} ${midY(from)} H ${to.x}`;
}

function dropPath(from: Box, to: Box) {
  const xEdge = from.x + CARD_W;
  const midX = xEdge + JOIN / 4;
  return `M ${xEdge} ${midY(from)} H ${midX} V ${midY(to)} H ${to.x}`;
}

function finalBus(upper: Box, lower: Box, final: Box) {
  const yUpper = midY(upper);
  const yLower = midY(lower);
  const yFinal = midY(final);
  const spine = final.x - JOIN / 2;
  return [
    `M ${upper.x + CARD_W} ${yUpper} H ${spine}`,
    `M ${lower.x + CARD_W} ${yLower} H ${spine}`,
    `M ${spine} ${yUpper} V ${yLower}`,
    `M ${spine} ${yFinal} H ${final.x}`,
  ].join(" ");
}

function GroupPath({
  title,
  group,
  matches,
}: {
  title: string;
  group: "A" | "B";
  matches: GroupGraphMatch[];
}) {
  if (matches.length === 0) return null;
  return (
    <div className="mg-group">
      <h3>{title}</h3>
      <ol className="mg-path">
        {matches.map((match, index) => {
          const done = match.status === "completed";
          return (
            <li key={match.id} className={done ? "mg-chip mg-chip-done" : "mg-chip"}>
              {index > 0 ? <span className="mg-join" aria-hidden /> : null}
              <div className="mg-chip-body">
                <span className="mg-chip-n">
                  {group}
                  {index + 1}
                </span>
                <span className="mg-chip-vs">
                  {match.radiant.name} vs {match.dire.name}
                </span>
                <span className="mg-chip-meta">
                  {done && match.winnerName
                    ? `${match.winnerName} won`
                    : formatScheduleWhen(match.scheduledAt)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TierBanner({
  box,
  width,
  tone,
  children,
}: {
  box: Box;
  width: number;
  tone: "upper" | "lower" | "grand";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute flex items-center gap-2 rounded-lg border px-3 py-1.5 font-display text-[0.72rem] font-bold tracking-[0.16em] uppercase",
        tone === "upper" &&
          "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
        tone === "lower" &&
          "border-violet-400/30 bg-violet-400/10 text-violet-300",
        tone === "grand" &&
          "border-amber-500/50 bg-amber-500/15 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.25)]",
      )}
      style={{ left: box.x, top: box.y, width }}
    >
      {tone === "grand" ? <Crown className="size-3.5" aria-hidden /> : null}
      {children}
    </div>
  );
}

type Connector = {
  d: string;
  lit: boolean;
  kind: "advance" | "drop" | "final";
};

const FOCUS_TABS: { id: ViewFocus; label: string }[] = [
  { id: "all", label: "All Brackets" },
  { id: "upper", label: "Upper Bracket" },
  { id: "lower", label: "Lower Bracket" },
  { id: "grand", label: "Grand Final" },
];

export function PlayoffGraph({
  view,
  groupMatches = [],
  compact = false,
}: {
  view: PlayoffView;
  groupMatches?: GroupGraphMatch[];
  compact?: boolean;
}) {
  const [focus, setFocus] = useState<ViewFocus>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const matchFor = (slot: PlayoffMatchView["slotKey"]) =>
    pick(view.matches, slot);
  const groupA = groupMatches.filter((row) => row.group === "A");
  const groupB = groupMatches.filter((row) => row.group === "B");

  const stackH = CARD_H * 2 + GAP_Y;
  const colX = (index: number) => SECTION_PAD + index * (CARD_W + JOIN);
  const upperBannerY = 0;
  const upperTop = upperBannerY + LABEL_H + 8;
  const lowerBannerY = upperTop + stackH + TIER_GAP;
  const lowerTop = lowerBannerY + LABEL_H + 8;

  const ub1: Box = { x: colX(0), y: upperTop };
  const ub2: Box = { x: colX(0), y: upperTop + CARD_H + GAP_Y };
  const uf: Box = { x: colX(1), y: upperTop + (stackH - CARD_H) / 2 };
  const lb1: Box = { x: colX(0), y: lowerTop };
  const lb2: Box = { x: colX(0), y: lowerTop + CARD_H + GAP_Y };
  const lb3: Box = { x: colX(1), y: lowerTop + (stackH - CARD_H) / 2 };
  const lf: Box = { x: colX(2), y: lb3.y };
  const gfMid = (midY(uf) + midY(lf)) / 2;
  const gf: Box = { x: colX(3), y: gfMid - CARD_H / 2 };

  const boardW = colX(3) + CARD_W + SECTION_PAD;
  const boardH = lowerTop + stackH + SECTION_PAD;

  const nodes: {
    slot: PlayoffMatchView["slotKey"];
    box: Box;
    band: ViewFocus;
    showcase?: boolean;
  }[] = [
    { slot: "ub1", box: ub1, band: "upper" },
    { slot: "ub2", box: ub2, band: "upper" },
    { slot: "uf", box: uf, band: "upper" },
    { slot: "lb1", box: lb1, band: "lower" },
    { slot: "lb2", box: lb2, band: "lower" },
    { slot: "lb3", box: lb3, band: "lower" },
    { slot: "lb_final", box: lf, band: "lower" },
    { slot: "final", box: gf, band: "grand", showcase: true },
  ];

  const done = (slot: PlayoffMatchView["slotKey"]) =>
    matchFor(slot)?.displayStatus === "completed";

  const connectors: Connector[] = [
    {
      d: forkPath(ub1, ub2, uf),
      lit: done("ub1") || done("ub2"),
      kind: "advance",
    },
    {
      d: dropPath(ub1, lb1),
      lit: done("ub1"),
      kind: "drop",
    },
    {
      d: dropPath(ub2, lb2),
      lit: done("ub2"),
      kind: "drop",
    },
    {
      d: forkPath(lb1, lb2, lb3),
      lit: done("lb1") || done("lb2"),
      kind: "advance",
    },
    {
      d: linePath(lb3, lf),
      lit: done("lb3"),
      kind: "advance",
    },
    {
      d: dropPath(uf, lf),
      lit: done("uf"),
      kind: "drop",
    },
    {
      d: finalBus(uf, lf, gf),
      lit: done("uf") || done("lb_final"),
      kind: "final",
    },
  ];

  useEffect(() => {
    if (compact || focus === "all") return;
    const target =
      focus === "upper"
        ? ub1
        : focus === "lower"
          ? lb1
          : gf;
    const el = scrollRef.current;
    if (!el) return;
    const left = Math.max(0, target.x - 24);
    el.scrollTo({ left, behavior: "smooth" });
  }, [focus, compact]);

  function dimmed(band: ViewFocus) {
    if (focus === "all") return false;
    return band !== focus;
  }

  return (
    <section className={cn("min-w-0", compact ? "mt-6" : "mb-6")}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="m-0 font-display text-xl tracking-wide text-foreground">
            {compact ? "Match graph" : "Tournament bracket"}
          </h2>
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            Winners advance right · losers drop to Lower Bracket
          </p>
        </div>

        {!compact ? (
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Bracket focus"
          >
            {FOCUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={focus === tab.id}
                onClick={() => setFocus(tab.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[0.72rem] font-semibold tracking-wide uppercase transition",
                  focus === tab.id
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!compact && (groupA.length > 0 || groupB.length > 0) ? (
        <div className="mg-groups mb-4">
          <GroupPath title="Group A" group="A" matches={groupA} />
          <GroupPath title="Group B" group="B" matches={groupB} />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-6 scrollbar-thin [scrollbar-color:rgba(245,158,11,0.2)_transparent]"
        tabIndex={0}
        aria-label="Playoff bracket, scroll sideways"
      >
        <div
          className="relative"
          style={{ width: boardW, height: boardH }}
          role="group"
          aria-label="Playoff bracket"
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={boardW}
            height={boardH}
            viewBox={`0 0 ${boardW} ${boardH}`}
            aria-hidden
          >
            <defs>
              <filter id="bracket-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {connectors.map((row) => (
              <path
                key={row.d}
                d={row.d}
                fill="none"
                stroke={
                  row.lit
                    ? row.kind === "drop"
                      ? "rgba(167,139,250,0.55)"
                      : row.kind === "final"
                        ? "rgba(245,158,11,0.65)"
                        : "rgba(52,211,153,0.45)"
                    : "rgba(255,255,255,0.15)"
                }
                strokeWidth={row.lit ? 1.5 : 1}
                strokeLinecap="square"
                strokeLinejoin="miter"
                filter={row.lit ? "url(#bracket-glow)" : undefined}
              />
            ))}
          </svg>

          <TierBanner
            box={{ x: colX(0), y: upperBannerY }}
            width={CARD_W * 2 + JOIN}
            tone="upper"
          >
            Upper Bracket · Quarterfinals → Semifinals → Upper Final
          </TierBanner>

          <TierBanner
            box={{ x: colX(0), y: lowerBannerY }}
            width={CARD_W * 3 + JOIN * 2}
            tone="lower"
          >
            Lower Bracket · 🔻 Losers drop in from Upper
          </TierBanner>

          <TierBanner
            box={{ x: gf.x, y: Math.max(0, gf.y - LABEL_H - 8) }}
            width={CARD_W}
            tone="grand"
          >
            Grand Final
          </TierBanner>

          {nodes.map(({ slot, box, band, showcase }) => {
            const match = matchFor(slot);
            if (!match) return null;
            return (
              <BracketNode
                key={slot}
                match={match}
                showcase={showcase}
                className={cn(
                  "absolute transition-opacity duration-300",
                  dimmed(band) && "opacity-25",
                )}
                style={{
                  left: box.x,
                  top: box.y,
                  width: CARD_W,
                  height: CARD_H,
                }}
              />
            );
          })}
        </div>
      </div>

      {!compact ? (
        <ul className="mt-1 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              aria-hidden
            />
            Live
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-400" aria-hidden />
            Upcoming
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-400" aria-hidden />
            Completed
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden>🔻</span>
            Loser drops to Lower Bracket
          </li>
        </ul>
      ) : null}
    </section>
  );
}
