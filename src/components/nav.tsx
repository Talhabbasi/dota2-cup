"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  "border-amber-500/50 bg-amber-500/5 text-foreground shadow-[0_0_18px_rgba(245,158,11,0.22)] hover:border-amber-500/70 hover:bg-amber-500/10 hover:text-foreground hover:shadow-[0_0_22px_rgba(245,158,11,0.35)] dark:border-amber-500/50 dark:bg-amber-500/5 dark:hover:border-amber-500/70 dark:hover:bg-amber-500/10 dark:hover:text-foreground";

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

const LINKS = [
  ["/", "Home"],
  ["/teams", "Teams"],
  ["/schedule", "Schedule"],
  ["/playoffs", "Playoffs"],
  ["/matches", "Matches"],
  ["/table", "Table"],
  ["/players", "Players"],
  ["/auction", "Auction"],
  ["/predictions", "Predictions"],
  ["/heroes", "Heroes"],
  ["/seasons", "Seasons"],
  ["/register", "Register"],
] as const;

export function Nav({ showSeasons = false }: { showSeasons?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const ready = useSyncExternalStore(
    subscribeNoop,
    clientReadySnapshot,
    serverReadySnapshot,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }
  const showRegister = status === "unauthenticated";
  const links = LINKS.filter(([href]) => {
    if (!showSeasons && href === "/seasons") return false;
    if (!showRegister && href === "/register") return false;
    return true;
  });

  useEffect(() => {
    for (const [href] of LINKS) {
      router.prefetch(href);
    }
  }, [router]);

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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1017]/90 backdrop-blur-md">
      <div className="flex items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-2.5 pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/mm-dota-cup-icon.png"
            alt=""
            width={32}
            height={32}
            sizes="32px"
            className="size-8 shrink-0 rounded-full ring-1 ring-white/15"
            priority
          />
          <span className="truncate font-display text-[0.82rem] font-bold tracking-[0.12em] text-white uppercase">
            MM Dota Cup
          </span>
          <Badge
            variant="outline"
            className="hidden h-5 border-primary/40 bg-primary/10 px-1.5 text-[0.62rem] font-semibold tracking-[0.12em] text-primary uppercase sm:inline-flex"
          >
            Season 1
          </Badge>
        </Link>

        <nav
          id="site-nav"
          aria-label="Primary"
          className="ml-2 hidden min-w-0 flex-1 items-center justify-center gap-0.5 min-[1280px]:flex"
        >
          {links.map(([href, label]) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              active={
                ready &&
                (href === "/" ? pathname === "/" : pathname.startsWith(href))
              }
            />
          ))}
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
        {links.map(([href, label]) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            active={
              ready &&
              (href === "/" ? pathname === "/" : pathname.startsWith(href))
            }
            mobile
          />
        ))}
      </nav>
    </header>
  );
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
        "text-[0.8rem] font-medium tracking-wide text-muted-foreground! transition-colors hover:text-foreground!",
        mobile
          ? "rounded-lg px-3 py-2.5 hover:bg-white/5"
          : "relative px-2.5 py-2",
        active && "text-primary!",
        active && mobile && "bg-primary/10",
      )}
    >
      {label}
      {active && !mobile ? (
        <span
          className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(245,158,11,0.85)]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
