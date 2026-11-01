"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Scoreboard at column width, with a full-size view so names and K/D/A stay readable. */
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cn("relative bg-black/20", className)}>
      {!loaded && !failed ? (
        <div
          className="absolute inset-0 z-10 flex min-h-[12rem] flex-col items-center justify-center gap-3"
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
        <button
          type="button"
          className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
          onClick={() => loaded && setOpen(true)}
          aria-label="View scoreboard at full size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
        </button>
      )}
      {open ? (
        <div
          className="fixed inset-0 z-[80] overflow-auto bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Scoreboard full size"
        >
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm text-white/80">
              Scroll to read names and K/D/A. The picture is not cropped.
            </p>
            <div className="flex gap-2">
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white"
              >
                Open original
              </a>
              <button
                type="button"
                className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto block h-auto w-auto max-w-none"
          />
        </div>
      ) : null}
    </div>
  );
}
