"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type UploadProgressPhase =
  | "idle"
  | "compress"
  | "upload"
  | "ocr"
  | "done";

function phaseCap(phase: UploadProgressPhase): number {
  switch (phase) {
    case "compress":
      return 12;
    case "upload":
      return 55;
    case "ocr":
      return 92;
    case "done":
      return 100;
    default:
      return 0;
  }
}

function phaseLabel(phase: UploadProgressPhase): string {
  if (phase === "compress") return "Preparing image…";
  if (phase === "upload") return "Uploading to S3…";
  if (phase === "ocr") return "Reading scoreboard…";
  if (phase === "done") return "Done";
  return "Working…";
}

/**
 * 0–100% bar. Advances by phase while upload/OCR runs (Server Actions
 * don't expose real byte progress).
 */
export function AdminUploadProgress({
  active,
  phase,
}: {
  active: boolean;
  phase: UploadProgressPhase;
}) {
  const [percent, setPercent] = useState(0);
  const shown = phase === "done" ? 100 : active ? percent : 0;
  const visible = active || phase === "done";

  useEffect(() => {
    if (!active || phase === "done" || phase === "idle") return;
    const cap = phaseCap(phase);
    const id = window.setInterval(() => {
      setPercent((prev) => {
        if (prev >= cap) return prev;
        const gap = cap - prev;
        const step = Math.max(1, Math.ceil(gap * 0.14));
        return Math.min(cap, prev + step);
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [active, phase]);

  if (!visible) return null;

  return (
    <div
      className="grid gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-busy={active && phase !== "done"}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{phaseLabel(phase)}</span>
        <span className="font-mono tabular-nums text-foreground">{shown}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-[#0a0d14]">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#58a6ff] transition-[width] duration-200 ease-out",
            shown >= 100 && "from-emerald-500 to-emerald-400",
          )}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}
