"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Scoreboard image with a spinner until the remote file finishes loading. */
export function MatchScreenshotImage({
  src,
  alt = "Match scoreboard",
  className,
  imgClassName,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative min-h-[12rem] overflow-hidden bg-black/20",
        className,
      )}
    >
      {!loaded && !failed ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span
            className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-amber-400"
            aria-hidden
          />
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Loading picture
          </span>
        </div>
      ) : null}
      {failed ? (
        <p className="m-0 px-4 py-10 text-center text-sm text-muted-foreground">
          Could not load scoreboard image.
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn(
            "h-auto w-full object-contain transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      )}
    </div>
  );
}
