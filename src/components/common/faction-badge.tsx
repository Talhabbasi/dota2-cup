import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export type Faction = "radiant" | "dire";

export type FactionBadgeProps = {
  side: Faction;
  /** Override visible label (defaults to Radiant / Dire). */
  label?: string;
  showIcon?: boolean;
  className?: string;
};

const STYLES: Record<Faction, string> = {
  radiant:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.18)]",
  dire: "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.18)]",
};

/**
 * Pre-styled Radiant (emerald) vs Dire (crimson) pill.
 */
export function FactionBadge({
  side,
  label,
  showIcon = true,
  className,
}: FactionBadgeProps) {
  const text = label ?? (side === "radiant" ? "Radiant" : "Dire");

  return (
    <span
      data-slot="faction-badge"
      data-side={side}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-[0.14em] uppercase",
        STYLES[side],
        className,
      )}
    >
      {showIcon ? <Swords className="size-3" aria-hidden /> : null}
      {text}
    </span>
  );
}
