import Link from "next/link";
import { PageHeader } from "@/components/common";
import { CUP_NAME } from "@/lib/brand";
import { getSeasonHistory } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "Season Archive",
  `Past ${CUP_NAME} seasons — champions and player insight.`,
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
          {seasons.map((season) => (
            <article key={season.id} className="season-history-card">
              <header>
                <p className="eyebrow">
                  Champions
                  <span className="badge badge-gold">Complete</span>
                </p>
                <h2>
                  <Link href={`/seasons/season-${season.number}`}>
                    Season {season.number}
                    {season.name !== `Season ${season.number}`
                      ? ` · ${season.name}`
                      : ""}
                  </Link>
                </h2>
              </header>
              {season.champion ? (
                <p className="season-history-winner">
                  Champion{" "}
                  <Link href={`/seasons/season-${season.number}`}>
                    {season.champion.name}
                  </Link>
                </p>
              ) : (
                <p className="muted">No champion recorded.</p>
              )}
              <p className="m-0 mt-3">
                <Link
                  href={`/seasons/season-${season.number}`}
                  className="text-link"
                >
                  Overview &amp; player insight →
                </Link>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
