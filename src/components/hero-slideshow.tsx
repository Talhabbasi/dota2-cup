"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const SLIDES = [
  {
    src: "/hero-slides/dota-2-windranger-radiant.jpg",
    alt: "Windranger on the Radiant offlane in Dota 2, official MM Dota Cup background",
    position: "center 32%",
  },
  {
    src: "/hero-slides/dota-2-juggernaut-ancient.jpg",
    alt: "Juggernaut and Radiant heroes at the Ancient in Dota 2, official MM Dota Cup background",
    position: "center 38%",
  },
  {
    src: "/hero-slides/dota-2-faceless-void-chronosphere.jpg",
    alt: "Faceless Void Chronosphere teamfight in Dota 2, official MM Dota Cup background",
    position: "center 30%",
  },
  {
    src: "/hero-slides/dota-2-roshan-pit.jpg",
    alt: "Roshan pit in Dota 2, official MM Dota Cup background",
    position: "center 28%",
  },
  {
    src: "/hero-slides/dota-2-luna-teamfight.jpg",
    alt: "Luna teamfight on the Dota 2 map, official MM Dota Cup background",
    position: "center 34%",
  },
  {
    src: "/hero-slides/dota-2-pudge-hook.jpg",
    alt: "Pudge hook on the Dire offlane in Dota 2, official MM Dota Cup background",
    position: "center 36%",
  },
  {
    src: "/hero-slides/dota-2-tidehunter-ravage.jpg",
    alt: "Tidehunter Ravage in a Dota 2 teamfight, official MM Dota Cup background",
    position: "center 32%",
  },
] as const;

const HOLD_MS = 7000;

export function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const indexRef = useRef(0);

  const go = useCallback((next: number) => {
    const wrapped = (next + SLIDES.length) % SLIDES.length;
    if (wrapped === indexRef.current) return;
    indexRef.current = wrapped;
    setIndex(wrapped);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || paused) return;
    const id = window.setInterval(() => {
      go(indexRef.current + 1);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [go, paused]);

  return (
    <div
      className={ready ? "hero-slides is-ready" : "hero-slides"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={i === index ? "hero-slide is-active" : "hero-slide"}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.src}
            alt={i === index ? slide.alt : ""}
            fill
            priority={i < 2}
            quality={82}
            sizes="1920px"
            className="hero-slide-photo"
            style={{ objectPosition: slide.position }}
          />
        </div>
      ))}
      <div className="hero-slide-nav" role="tablist" aria-label="Dota 2 backgrounds">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            role="tab"
            aria-label={slide.alt}
            aria-selected={i === index}
            className={i === index ? "hero-slide-dot is-active" : "hero-slide-dot"}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
