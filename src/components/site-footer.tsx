import Image from "next/image";
import Link from "next/link";
import { getCurrentSeasonSafe } from "@/lib/seasons";

const LINKS = [
  ["/", "Home"],
  ["/teams", "Teams"],
  ["/schedule", "Schedule"],
  ["/playoffs", "Playoffs"],
  ["/matches", "Matches"],
  ["/players", "Players"],
  ["/auction", "Auction"],
  ["/seasons", "Seasons"],
] as const;

export async function SiteFooter({
  showSeasons = false,
}: {
  showSeasons?: boolean;
}) {
  const season = await getCurrentSeasonSafe();
  const seasonBit = season ? `Season ${season.number}` : "Indoor MM";
  const links = showSeasons
    ? LINKS
    : LINKS.filter(([href]) => href !== "/seasons");
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link href="/" className="footer-brand">
          <Image
            src="/mm-dota-cup-icon.png"
            alt=""
            width={28}
            height={28}
            className="footer-brand-icon"
          />
          <span>
            <strong>MM Dota Cup</strong>
            <small>{seasonBit} · Pakistan time</small>
          </span>
        </Link>
        <nav className="footer-nav" aria-label="Footer">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
