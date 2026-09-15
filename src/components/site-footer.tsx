import Image from "next/image";
import Link from "next/link";

const LINKS = [
  ["/", "Home"],
  ["/teams", "Teams"],
  ["/schedule", "Schedule"],
  ["/playoffs", "Playoffs"],
  ["/matches", "Matches"],
  ["/players", "Players"],
] as const;

export function SiteFooter() {
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
            <small>Indoor MM · Pakistan time</small>
          </span>
        </Link>
        <nav className="footer-nav" aria-label="Footer">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
