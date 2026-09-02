"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "./auth-buttons";

const LINKS = [
  ["/", "Home"],
  ["/register", "Register"],
  ["/teams", "Teams"],
  ["/matches", "Matches"],
  ["/table", "Table"],
  ["/players", "Players"],
  ["/heroes", "Heroes"],
] as const;

export function Nav() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark" aria-hidden>
          ◈
        </span>
        MM Dota Cup
      </Link>
      <button
        type="button"
        className={menuOpen ? "nav-toggle is-open" : "nav-toggle"}
        aria-expanded={menuOpen}
        aria-controls="site-nav"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="nav-toggle-bars" aria-hidden />
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
      </button>
      <nav
        id="site-nav"
        className={menuOpen ? "site-nav is-open" : "site-nav"}
      >
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
      <div className="header-auth">
        <AuthButtons />
      </div>
    </header>
  );
}
