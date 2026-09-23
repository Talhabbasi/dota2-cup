import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLUMNS = [
  {
    title: "Browse",
    links: [
      ["/", "Home"],
      ["/teams", "Teams"],
      ["/players", "Players"],
      ["/heroes", "Heroes"],
    ],
  },
  {
    title: "Compete",
    links: [
      ["/schedule", "Schedule"],
      ["/playoffs", "Playoffs"],
      ["/matches", "Matches"],
      ["/table", "Table"],
    ],
  },
  {
    title: "More",
    links: [
      ["/auction", "Auction"],
      ["/predictions", "Predictions"],
      ["/register", "Register"],
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-1 border-t border-white/10 bg-[#080b0f]">
      <div className="mx-auto grid w-[min(1180px,calc(100%-2rem))] gap-8 py-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] md:gap-12 md:py-12">
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-3 text-inherit!">
            <Image
              src="/mm-dota-cup-icon.png"
              alt=""
              width={36}
              height={36}
              sizes="36px"
              className="size-9 rounded-full ring-1 ring-white/15"
            />
            <span className="grid gap-1">
              <span className="font-display text-sm font-bold tracking-[0.14em] text-white uppercase">
                MM Dota Cup
              </span>
              <Badge
                variant="outline"
                className="h-5 w-fit border-amber-500/40 bg-amber-500/10 px-2 text-[0.62rem] tracking-[0.14em] text-amber-300 uppercase"
              >
                Season 1
              </Badge>
            </span>
          </Link>
          <p className="mt-4 mb-0 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Indoor Dota 2 cup in Pakistan. Captains, brackets, and kickoffs in
            one place.
          </p>
          <p className="mt-3 mb-0 text-xs text-slate-500">
            © {year} MM Dota Cup. All rights reserved.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8"
        >
          {COLUMNS.map((column) => (
            <div key={column.title} className="min-w-0">
              <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                {column.title}
              </p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {column.links.map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "text-sm text-zinc-400! transition-colors duration-200",
                        "hover:text-amber-300!",
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
        <p className="mx-auto my-0 w-[min(1180px,calc(100%-2rem))] py-4 text-center text-[0.72rem] tracking-[0.08em] text-slate-500 uppercase sm:text-left">
          Official MM Dota Cup Platform · Season 1
        </p>
      </div>
    </footer>
  );
}
