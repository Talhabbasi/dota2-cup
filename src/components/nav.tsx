"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "./auth-buttons";

const LINKS = [
  ["/", "Home"],
  ["/teams", "Teams"],
  ["/matches", "Matches"],
  ["/table", "Table"],
  ["/players", "Players"],
  ["/heroes", "Heroes"],
] as const;

export function Nav() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden>
          ◈
        </span>
        MM Dota Cup
      </Link>
      <nav className="site-nav">
        {LINKS.map(([href, label]) => {
          const active =
            ready &&
            (href === "/" ? pathname === "/" : pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={active ? "nav-link nav-active" : "nav-link"}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <AuthButtons />
    </header>
  );
}
