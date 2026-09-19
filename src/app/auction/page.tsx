import Link from "next/link";
import { getAuctionResultsBySeason } from "@/lib/auction-results";
import { formatPoints } from "@/lib/constants";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Player Auction",
  "See which MM Dota Cup players sold to which team and for how many points in the season auction.",
);

function statusLabel(status: string, live: boolean) {
  if (live) return "Live";
  if (status === "archived") return "Closed";
  if (status === "upcoming") return "Upcoming";
  return status;
}

function seasonTitle(number: number, name: string) {
  if (number <= 0) return name;
  if (name !== `Season ${number}`) return `Season ${number} · ${name}`;
  return `Season ${number}`;
}

export default async function AuctionPage() {
  const seasons = await getAuctionResultsBySeason();
  const soldCount = seasons.reduce((sum, season) => sum + season.soldCount, 0);
  const spent = seasons.reduce((sum, season) => sum + season.spent, 0);

  return (
    <div className="page auction-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Transfer market</p>
          <h1>Auction</h1>
          <p className="muted auction-hero-copy">
            Who sold, which franchise won the lot, and the winning bid — season
            by season. Captains are not in the auction.
          </p>
          {soldCount > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{soldCount}</strong> sold
              </span>
              <span className="teams-list-hero-pill">
                <strong>{formatPoints(spent)}</strong> points spent
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {seasons.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🔨
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No lots have been confirmed yet. After an admin confirms a bid in
            Discord, the player, team, and price will show here.
          </p>
        </div>
      ) : (
        <div className="season-history-stack">
          {seasons.map((season) => (
            <article key={season.seasonId} className="season-history-card">
              <header>
                <p className="eyebrow">
                  {statusLabel(season.status, season.live)}
                  {season.live ? (
                    <span className="badge badge-gold">Now</span>
                  ) : null}
                </p>
                <h2>{seasonTitle(season.number, season.name)}</h2>
              </header>
              <p className="auction-season-meta">
                {season.soldCount} sold
                {season.soldCount > 0 ? ` · ${season.spentLabel} pts spent` : ""}
              </p>

              {season.sales.length === 0 ? (
                <p className="muted">
                  No rostered auction players for this season yet.
                </p>
              ) : (
                <ol className="auction-sale-list">
                  {season.sales.map((sale, index) => (
                    <li
                      key={sale.lotId}
                      className={
                        sale.highest
                          ? "auction-sale-row is-highest"
                          : "auction-sale-row"
                      }
                    >
                      <span className="auction-sale-lot">{index + 1}</span>
                      <div className="auction-sale-player">
                        <Link href={`/players/${sale.playerId}`}>
                          {sale.playerName}
                        </Link>
                        <span className="auction-sale-tags">
                          <span className="team-medal-pill">{sale.medalLabel}</span>
                          {sale.rolesLabel ? (
                            <span className="team-role-pill">{sale.rolesLabel}</span>
                          ) : null}
                          {sale.highest ? (
                            <span className="badge badge-gold">Top bid</span>
                          ) : null}
                          {sale.reserve ? (
                            <span className="team-role-pill">Unsold · 2,000</span>
                          ) : null}
                        </span>
                      </div>
                      <p className="auction-sale-team">
                        <span>sold to</span>{" "}
                        <Link href={`/teams/${sale.teamId}`}>{sale.teamName}</Link>
                      </p>
                      <p className="auction-sale-price">
                        {sale.soldPriceLabel}
                        <small> pts</small>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
