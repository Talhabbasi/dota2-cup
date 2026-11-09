"use client";

import { useEffect, useRef } from "react";
import { avatarSvg } from "@/lib/avatar/portrait";
import { AVATAR_CANVAS, type AvatarConfig } from "@/lib/avatar/types";

const renderVersions = new WeakMap<HTMLCanvasElement, number>();

export async function renderAvatarToCanvas(
  canvas: HTMLCanvasElement,
  config: AvatarConfig,
  size: number = AVATAR_CANVAS.width,
) {
  const version = (renderVersions.get(canvas) ?? 0) + 1;
  renderVersions.set(canvas, version);
  const img = new Image();
  const ready = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Avatar illustration could not render"));
  });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(config))}`;
  await ready;
  if (renderVersions.get(canvas) !== version) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  canvas.dataset.renderedConfig = JSON.stringify(config);
  canvas.dataset.renderer = "vector-v2";
}

export function AvatarCanvas({
  config,
  size = 320,
  className,
  testId,
}: {
  config: AvatarConfig;
  size?: number;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(config);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    void renderAvatarToCanvas(canvas, config, size);
    return () => {
      renderVersions.set(canvas, (renderVersions.get(canvas) ?? 0) + 1);
    };
    // key captures every config field change without unstable callback deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      data-testid={testId}
      style={{ width: size, height: size }}
      aria-label="Avatar preview"
    />
  );
}
