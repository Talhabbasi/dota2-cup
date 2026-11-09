"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogIn } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CUP_ICON_PATH,
  CUP_NAME,
  GAME_HOME_HREF,
  HUB_NAME,
  PUBG_CUP_NAME,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

function subscribeNoop() {
  return () => {};
}

function clientReadySnapshot() {
  return true;
}

function serverReadySnapshot() {
  return false;
}

const authButtonClass =
  "h-10 border-white/10 bg-[#161D2A] text-[#F8FAFC] shadow-none transition-colors duration-200 hover:border-[#F5AE28]/50 hover:bg-[#1E2838] hover:text-[#F8FAFC]";

const AuthButtons = dynamic(
  () =>
    import("@/components/auth-buttons").then((mod) => ({
      default: mod.AuthButtons,
    })),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled className={authButtonClass}>
        <LogIn />
        Sign in
      </Button>
    ),
  },
);

const HUB_LINKS = [
  ["/", "Home"],
  ["/dota", "Dota 2"],
  ["/pubg", "PUBG"],
  ["/seasons", "Seasons"],
  ["/blog", "Blog"],
  ["/fantasy", "Fantasy"],
] as const;

type NavItem = { href: string; label: string };

export function Nav({
  showSeasons = false,
  seasonLabel,
  showRegister = true,
  game = "DOTA",
  auctionHref = "/auction",
  hubMode = false,
}: {
  showSeasons?: boolean;
  seasonLabel: string;
  showRegister?: boolean;
  game?: string;
  auctionHref?: string | null;
  hubMode?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const moreMenuId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const ready = useSyncExternalStore(
    subscribeNoop,
    clientReadySnapshot,
    serverReadySnapshot,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
    setMoreOpen(false);
  }
  const pubg = game === "PUBG";
  const gameHome = pubg ? GAME_HOME_HREF.PUBG : GAME_HOME_HREF.DOTA;
  const brandName = hubMode
    ? HUB_NAME
    : pubg
      ? PUBG_CUP_NAME
      : CUP_NAME;

  let primary: NavItem[] = [];
  let more: NavItem[] = [];

  if (hubMode) {
    primary = HUB_LINKS.filter(([href]) => showSeasons || href !== "/seasons").map(
      ([href, label]) => ({ href, label }),
    );
  } else {
    primary = [
      { href: gameHome, label: "Home" },
      { href: `${gameHome}/teams`, label: "Teams" },
      { href: "/schedule", label: "Schedule" },
      { href: `${gameHome}/matches`, label: "Matches" },
      { href: pubg ? "/pubg/table" : "/table", label: "Table" },
      { href: "/predictions", label: "Predictions" },
    ];
    if (auctionHref) {
      primary.splice(2, 0, { href: auctionHref, label: "Auction" });
    }

    more = [
      { href: "/players", label: "Players" },
      ...(pubg ? [] : [{ href: "/playoffs", label: "Playoffs" }]),
      { href: "/player-insight", label: "Player Insight" },
      ...(pubg ? [] : [{ href: "/heroes", label: "Heroes" }]),
      ...(pubg ? [] : [{ href: "/fantasy", label: "Fantasy" }]),
      ...(showSeasons ? [{ href: "/seasons", label: "Seasons" }] : []),
      { href: "/blog", label: "Blog" },
      ...(showRegister ? [{ href: "/register", label: "Register" }] : []),
      { href: "/", label: "All games" },
    ];
  }

  const mobileLinks = [...primary, ...more];

  useEffect(() => {
    for (const item of mobileLinks) {
      router.prefetch(item.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- links rebuilt from these flags
  }, [router, showSeasons, showRegister, pubg, auctionHref, hubMode, gameHome]);

  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMoreOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    if (menuOpen) document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.body.classList.remove("nav-open");
    };
  }, [menuOpen, moreOpen]);

  const moreActive = more.some((item) => isNavActive(pathname, item.href));

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080B12]/80 backdrop-blur-xl">
      <div className="flex h-[76px] items-center gap-4 px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src={CUP_ICON_PATH}
            alt=""
            width={32}
            height={32}
            sizes="32px"
            className="size-8 shrink-0 rounded-full ring-1 ring-white/15"
            priority
          />
          <span className="truncate font-display text-[0.82rem] font-bold tracking-[0.12em] text-white uppercase">
            {brandName}
          </span>
          <Badge
            variant="outline"
            className="hidden h-5 border-primary/40 bg-primary/10 px-1.5 text-[0.62rem] font-semibold tracking-[0.12em] text-primary uppercase sm:inline-flex"
          >
            {hubMode ? "Hub" : seasonLabel}
          </Badge>
        </Link>
        {!hubMode ? (
          <div className="nav-game-switch" aria-label="Tournament">
            <Link
              href="/dota"
              className={game !== "PUBG" ? "is-on" : ""}
              aria-current={game !== "PUBG" ? "page" : undefined}
            >
              Dota 2
            </Link>
            <Link
              href="/pubg"
              className={game === "PUBG" ? "is-on" : ""}
              aria-current={game === "PUBG" ? "page" : undefined}
            >
              PUBG
            </Link>
          </div>
        ) : null}

        <nav
          id="site-nav"
          aria-label="Primary"
          className="ml-4 hidden min-w-0 flex-1 items-center justify-center gap-1 min-[1280px]:flex"
        >
          {primary.map((item) => (
            <NavLink
              key={`${item.href}-${item.label}`}
              href={item.href}
              label={item.label}
              active={ready && isNavActive(pathname, item.href)}
            />
          ))}
          {more.length > 0 ? (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-2 font-display text-[0.95rem] font-semibold tracking-wide text-[#A6AFBD] transition-colors duration-200 hover:text-[#F8FAFC]",
                  (moreOpen || moreActive) && "text-primary",
                )}
                aria-expanded={moreOpen}
                aria-controls={moreMenuId}
                onClick={() => setMoreOpen((open) => !open)}
              >
                More
                <ChevronDown
                  className={cn(
                    "size-3.5 transition",
                    moreOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {moreOpen ? (
                <div
                  id={moreMenuId}
                  className="arena-menu absolute top-full left-1/2 z-50 mt-2 min-w-[12rem] -translate-x-1/2 rounded-xl border border-white/8 bg-[#161D2A] p-1.5 shadow-2xl"
                >
                  {more.map((item) => (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      prefetch
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm text-[#A6AFBD] transition-colors duration-150 hover:bg-white/5 hover:text-[#F8FAFC]",
                        isNavActive(pathname, item.href) &&
                          "bg-primary/10 text-primary",
                      )}
                      onClick={() => setMoreOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AuthButtons />
          <button
            type="button"
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-background text-foreground min-[1280px]:hidden",
              menuOpen && "border-primary/40",
            )}
            aria-expanded={menuOpen}
            aria-controls="site-nav-mobile"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span className="flex w-4 flex-col gap-[5px]" aria-hidden>
              <span
                className={cn(
                  "block h-px w-full bg-foreground transition",
                  menuOpen && "translate-y-[6px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-px w-full bg-foreground transition",
                  menuOpen && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-px w-full bg-foreground transition",
                  menuOpen && "-translate-y-[6px] -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <nav
        id="site-nav-mobile"
        aria-label="Primary"
        className={cn(
          "border-t border-white/10 px-3 py-2 min-[1280px]:hidden",
          menuOpen ? "flex flex-col gap-1" : "hidden",
        )}
      >
        {mobileLinks.map((item) => (
          <NavLink
            key={`${item.href}-${item.label}-m`}
            href={item.href}
            label={item.label}
            active={ready && isNavActive(pathname, item.href)}
            mobile
          />
        ))}
      </nav>
    </header>
  );
}

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/dota") {
    return pathname === "/dota" || pathname.startsWith("/dota/");
  }
  if (href === "/pubg") {
    return pathname === "/pubg" || pathname.startsWith("/pubg/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
  mobile = false,
}: {
  href: string;
  label: string;
  active: boolean;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "font-display text-[0.95rem] font-semibold tracking-wide text-[#A6AFBD]! transition-colors duration-200 hover:text-[#F8FAFC]!",
        mobile
          ? "rounded-lg px-3 py-3 hover:bg-white/5"
          : "relative px-3 py-2",
        active && "text-[#F5AE28]!",
        active && mobile && "bg-[#F5AE28]/10",
      )}
    >
      {label}
      {!mobile ? (
        <span
          className={cn(
            "absolute inset-x-3 bottom-0.5 h-0.5 origin-center scale-x-0 rounded-full bg-[#F5AE28] transition-transform duration-200",
            active && "scale-x-100",
          )}
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
