"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type ChampionSlide = {
  id: string;
  href: string;
  image: string;
  alt: string;
  label: string;
  team: string;
  player: string | null;
};

export function ChampionSlider({ slides }: { slides: ChampionSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const safe = count === 0 ? 0 : index % count;
  const slide = slides[safe];

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [count]);

  if (!slide) return null;

  return (
    <div className="arena-slider">
      {slides.map((item, itemIndex) => (
        <Image
          key={item.id}
          src={item.image}
          alt={itemIndex === safe ? item.alt : ""}
          fill
          priority={itemIndex === 0}
          sizes="100vw"
          className={itemIndex === safe ? "arena-hero-photo is-on" : "arena-hero-photo"}
        />
      ))}
      <div className="arena-slider-caption">
        <p>{slide.label}</p>
        <strong>{slide.team}</strong>
        {slide.player ? <span>Winner {slide.player}</span> : null}
        <Link href={slide.href}>Season page</Link>
      </div>
      {count > 1 ? (
        <div className="arena-slider-controls">
          <button
            type="button"
            aria-label="Previous champion"
            onClick={() => setIndex((current) => (current - 1 + count) % count)}
          >
            Prev
          </button>
          {slides.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={itemIndex === safe ? "true" : undefined}
              className={itemIndex === safe ? "is-on" : ""}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
          <button
            type="button"
            aria-label="Next champion"
            onClick={() => setIndex((current) => (current + 1) % count)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
