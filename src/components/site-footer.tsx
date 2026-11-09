import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CUP_ICON_PATH,
  CUP_NAME,
  CUP_TAGLINE,
  GAME_HOME_HREF,
  HUB_NAME,
  HUB_TAGLINE,
  PUBG_CUP_NAME,
  PUBG_CUP_TAGLINE,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

const HUB_COLUMNS = [
  {
    title: "Games",
    links: [
      ["/dota", "Dota 2"],
      ["/pubg", "PUBG"],
    ],
  },
  {
    title: "Hub",
    links: [
      ["/seasons", "Seasons"],
      ["/blog", "Blog"],
      ["/fantasy", "Fantasy"],
    ],
  },
  {
    title: "Account",
    links: [
      ["/register", "Register"],
    ],
  },
] as const;

function cupColumns(gameHome: string) {
  return [
    {
      title: "Browse",
      links: [
        [gameHome, "Home"],
        [`${gameHome}/teams`, "Teams"],
        ["/players", "Players"],
        ["/player-insight", "Player Insight"],
        ["/heroes", "Heroes"],
      ] as const,
    },
    {
      title: "Compete",
      links: [
        ["/schedule", "Schedule"],
        ["/playoffs", "Playoffs"],
        [`${gameHome}/matches`, "Matches"],
        [gameHome === "/pubg" ? "/pubg/table" : "/table", "Table"],
      ] as const,
    },
    {
      title: "More",
      links: [
        ["/predictions", "Predictions"],
        ["/fantasy", "Fantasy"],
        ["/blog", "Blog"],
        ["/register", "Register"],
        ["/seasons", "Seasons"],
        ["/", "All games"],
      ] as const,
    },
  ] as const;
}

export function SiteFooter({
  seasonLabel,
  game = "DOTA",
  hubMode = false,
}: {
  seasonLabel: string;
  game?: string;
  hubMode?: boolean;
}) {
  const year = new Date().getFullYear();
  const brandName = hubMode
    ? HUB_NAME
    : game === "PUBG"
      ? PUBG_CUP_NAME
      : CUP_NAME;
  const tagline = hubMode
    ? HUB_TAGLINE
    : game === "PUBG"
      ? PUBG_CUP_TAGLINE
      : CUP_TAGLINE;
  const gameHome =
    game === "PUBG" ? GAME_HOME_HREF.PUBG : GAME_HOME_HREF.DOTA;
  const columns = hubMode ? HUB_COLUMNS : cupColumns(gameHome);

  return (
    <footer className="relative z-1 border-t border-white/8 bg-[#080B12]">
      <div className="mx-auto grid w-[min(1360px,calc(100%-2rem))] gap-8 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] md:gap-12 md:py-16">
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-3 text-inherit!">
            <Image
              src={CUP_ICON_PATH}
              alt=""
              width={36}
              height={36}
              sizes="36px"
              className="size-9 rounded-full ring-1 ring-white/15"
            />
            <span className="grid gap-1">
              <span className="font-display text-sm font-bold tracking-[0.14em] text-white uppercase">
                {brandName}
              </span>
              <Badge
                variant="outline"
                className="h-5 w-fit border-amber-500/40 bg-amber-500/10 px-2 text-[0.62rem] tracking-[0.14em] text-amber-300 uppercase"
              >
                {hubMode ? "Hub" : seasonLabel}
              </Badge>
            </span>
          </Link>
          <p className="mt-4 mb-0 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {tagline}
          </p>
          <p className="mt-3 mb-0 text-xs text-slate-500">
            © {year} {HUB_NAME}. All rights reserved.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8"
        >
          {columns.map((column) => (
            <div key={column.title} className="min-w-0">
              <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                {column.title}
              </p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {column.links
                  .filter(
                    ([href]) =>
                      hubMode ||
                      game !== "PUBG" ||
                      (href !== "/heroes" &&
                        href !== "/playoffs" &&
                        href !== "/fantasy"),
                  )
                  .map(([href, label]) => (
                    <li key={`${href}-${label}`}>
                      <Link
                        href={href}
                        className={cn(
                          "text-sm text-[#A6AFBD]! transition-colors duration-200",
                          "hover:text-[#F5AE28]!",
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto my-0 w-[min(1360px,calc(100%-2rem))] py-4 text-center text-[0.72rem] tracking-[0.08em] text-[#697586] uppercase sm:text-left">
          {hubMode
            ? `${HUB_NAME} · Pick a game to enter a cup`
            : `Official ${brandName} · ${seasonLabel}`}
        </p>
      </div>
    </footer>
  );
}
