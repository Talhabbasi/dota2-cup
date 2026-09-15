"use client";

import { useEffect, useState } from "react";

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

export function MatchCountdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) {
    return (
      <div className="countdown" aria-hidden>
        <span className="countdown-unit">
          <b>--</b>
          <small>Days</small>
        </span>
        <span className="countdown-unit">
          <b>--</b>
          <small>Hrs</small>
        </span>
        <span className="countdown-unit">
          <b>--</b>
          <small>Min</small>
        </span>
        <span className="countdown-unit">
          <b>--</b>
          <small>Sec</small>
        </span>
      </div>
    );
  }

  const remain = new Date(at).getTime() - now;
  const { days, hours, minutes, seconds, total } = parts(remain);

  if (total <= 0) {
    return (
      <p className="countdown-live">
        <span className="countdown-live-dot" />
        Match window is open
      </p>
    );
  }

  return (
    <div className="countdown" aria-label="Time until kickoff">
      {days > 0 ? (
        <span className="countdown-unit">
          <b>{pad(days)}</b>
          <small>Days</small>
        </span>
      ) : null}
      <span className="countdown-unit">
        <b>{pad(hours)}</b>
        <small>Hrs</small>
      </span>
      <span className="countdown-unit">
        <b>{pad(minutes)}</b>
        <small>Min</small>
      </span>
      <span className="countdown-unit">
        <b>{pad(seconds)}</b>
        <small>Sec</small>
      </span>
    </div>
  );
}
