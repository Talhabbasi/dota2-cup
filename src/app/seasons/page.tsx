import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { CUP_NAME, PUBG_CUP_NAME } from "@/lib/brand";
import { championRosterArt } from "@/lib/season-champion-art";
import { getSeasonHistory } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "Season Archive",
  `Past ${CUP_NAME} and ${PUBG_CUP_NAME} seasons — champions and player insight.`,
);

export default async function SeasonsPage() {
  const seasons = await getSeasonHistory();

  return (
    <div className="page seasons-page">
      <PageHeader
        eyebrow="Archive"
        title="Seasons"
        subtitle="Finished cups only. Open a season for the champion and player insight."
        pills={[
          {
            value: seasons.length,
            label: `season${seasons.length === 1 ? "" : "s"}`,
          },
        ]}
      />

      {seasons.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            No completed seasons yet. When the live cup ends and a champion is
            crowned, it will appear here.
          </p>
        </div>
      ) : (
        <div className="season-history-stack">
          {seasons.map((season) => {
            const href = `/seasons/${season.game.toLowerCase()}-${season.number}`;
            const art = championRosterArt(season.game, season.number);
            return (
              <article
                key={season.id}
                className={art ? "season-history-card has-art" : "season-history-card"}
              >
                {art ? (
                  <Link href={href} className="season-history-art" tabIndex={-1} aria-hidden="true">
                    <Image src={art.src} alt="" fill sizes="(max-width: 760px) 100vw, 420px" />
                  </Link>
                ) : null}
                <div className="season-history-body">
                  <header>
                    <p className="eyebrow">
                      Champions
                      <span className="badge badge-gold">Complete</span>
                    </p>
                    <h2>
                      <Link href={href}>
                        {season.game === "PUBG" ? "PUBG" : "Dota"} Season {season.number}
                        {season.name !== `Season ${season.number}`
                          ? ` · ${season.name}`
                          : ""}
                      </Link>
                    </h2>
                  </header>
                  {season.champion ? (
                    <p className="season-history-winner">
                      Champion{" "}
                      <Link href={href}>{season.champion.name}</Link>
                    </p>
                  ) : (
                    <p className="muted">No champion recorded.</p>
                  )}
                  {art ? <p className="season-history-lineup">{art.lineup}</p> : null}
                  <p className="m-0 mt-3">
                    <Link href={href} className="text-link">
                      Overview &amp; player insight →
                    </Link>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
