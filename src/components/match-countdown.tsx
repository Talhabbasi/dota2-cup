"use client";

import { memo, useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, total };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

const UNITS = [
  ["days", "Days"],
  ["hours", "Hrs"],
  ["minutes", "Min"],
  ["seconds", "Sec"],
] as const;

const CountdownTiles = memo(function CountdownTiles({
  values,
}: {
  values: Record<(typeof UNITS)[number][0], string>;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Time until kickoff">
      {UNITS.map(([key, label]) => (
        <span
          key={key}
          className="grid min-w-16 justify-items-center rounded-lg border border-white/10 bg-[#0a0d14]/70 px-2.5 py-2 backdrop-blur-md"
        >
          <b className="font-mono text-xl font-bold tabular-nums text-foreground">
            {values[key]}
          </b>
          <small className="mt-1 text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            {label}
          </small>
        </span>
      ))}
    </div>
  );
});

/**
 * Interval state lives only here so hero/parent trees do not re-render every tick.
 */
export const MatchCountdown = memo(function MatchCountdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) {
    return (
      <CountdownTiles
        values={{ days: "--", hours: "--", minutes: "--", seconds: "--" }}
      />
    );
  }

  const remain = new Date(at).getTime() - now;
  const { days, hours, minutes, seconds, total } = parts(remain);

  if (total <= 0) {
    return (
      <p className="m-0 inline-flex items-center gap-2 font-display text-sm tracking-[0.12em] text-dire uppercase">
        <span className="size-2 rounded-full bg-dire shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
        Match window is open
      </p>
    );
  }

  return (
    <CountdownTiles
      values={{
        days: pad(days),
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
      }}
    />
  );
});
