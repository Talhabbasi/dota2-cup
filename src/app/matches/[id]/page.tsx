import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, getMatch, getMatchMeta } from "@/lib/data";
import { formatKillScore, matchKillTotals } from "@/lib/match-score";
import { loadHeroCatalog, heroIconUrl } from "@/lib/opendota";
import type { Metadata } from "next";

export { dynamic } from "@/lib/dynamic-route";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchMeta(id);
  if (!match) return { title: "Match" };
  return {
    title: match.title,
    description: `${match.title} — MM Dota Cup match result${
      match.openDotaId ? ` · Match ${match.openDotaId}` : ""
    }.`,
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const catalog = await loadHeroCatalog();
  const byName = new Map(catalog.map((h) => [h.name.toLowerCase(), h]));
  const byId = new Map(catalog.map((h) => [h.id, h]));

  const radiant = match.players.filter((p) => p.side === "radiant");
  const dire = match.players.filter((p) => p.side === "dire");
  const winner =
    match.winnerTeam?.name ?? (match.radiantWin ? "Radiant" : "Dire");
  const { radiantKills, direKills, hasScore } = matchKillTotals(match.players, {
    radiantScore: match.radiantScore,
    direScore: match.direScore,
  });
  const radiantWon =
    match.winnerTeam?.id === match.radiantTeam?.id || match.radiantWin === true;
  const direWon =
    match.winnerTeam?.id === match.direTeam?.id || match.radiantWin === false;

  return (
    <div className="page">
      <Link href="/matches" className="back-link">
        ← Matches
      </Link>

      <section className="score-banner score-banner-enhanced">
        <div className={`score-side ${radiantWon ? "won" : ""}`}>
          <p className="eyebrow side-r">Radiant</p>
          <h1>{match.radiantTeam?.name ?? "Radiant"}</h1>
          {hasScore ? (
            <p className="score-side-kills">{radiantKills} kills</p>
          ) : null}
        </div>
        <div className="vs-mid score-banner-mid">
          {hasScore ? (
            <span className="score-banner-kills" aria-label="Kill score">
              <span className={radiantWon ? "leading" : ""}>{radiantKills}</span>
              <span className="score-sep">:</span>
              <span className={direWon ? "leading" : ""}>{direKills}</span>
            </span>
          ) : null}
          <span className="badge">
            {match.openDotaId.startsWith("manual-")
              ? "Result recorded"
              : `Match ${match.openDotaId}`}
          </span>
          <span className="vs-label">vs</span>
          <span className={`vs-winner ${direWon ? "dire-win" : ""}`}>
            {winner} win
          </span>
          <span className="vs-meta">{formatDuration(match.duration)}</span>
          {hasScore ? (
            <span className="muted score-kill-caption">
              {formatKillScore(radiantKills, direKills)}
            </span>
          ) : null}
        </div>
        <div className={`score-side dire ${direWon ? "won" : ""}`}>
          <p className="eyebrow side-d">Dire</p>
          <h1>{match.direTeam?.name ?? "Dire"}</h1>
          {hasScore ? (
            <p className="score-side-kills">{direKills} kills</p>
          ) : null}
        </div>
      </section>

      {match.players.length === 0 ? (
        <section className="empty-panel">
          <p className="muted" style={{ margin: 0 }}>
            Winner is on the site. Heroes and K/D/A appear after a SCOREBOARD
            screenshot is posted in Discord #results.
          </p>
        </section>
      ) : (
        (["Radiant", "Dire"] as const).map((label) => {
        const rows = label === "Radiant" ? radiant : dire;
        return (
          <section key={label} className="scoreboard">
            <h2 className={label === "Radiant" ? "side-r" : "side-d"}>{label}</h2>
            <div className="table-wrap glass">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Hero</th>
                    <th>K/D/A</th>
                    <th>LH / DN</th>
                    <th>GPM / XPM</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const hero =
                      (p.heroId ? byId.get(p.heroId) : undefined) ??
                      byName.get(p.hero.toLowerCase());
                    return (
                      <tr key={p.id}>
                        <td>
                          {p.player ? (
                            <Link href={`/players/${p.player.id}`}>
                              {p.player.steamName}
                            </Link>
                          ) : (
                            `Unknown ${p.steam32}`
                          )}
                          {p.unknown ? (
                            <div className="muted">Unregistered</div>
                          ) : null}
                        </td>
                        <td>
                          {hero ? (
                            <Link href={`/heroes/${hero.slug}`} className="match-hero-cell">
                              <Image
                                src={heroIconUrl(hero.slug)}
                                alt={hero.name}
                                width={32}
                                height={32}
                                className="match-hero-icon"
                              />
                              {hero.name}
                            </Link>
                          ) : (
                            p.hero
                          )}
                        </td>
                        <td>
                          {p.kills}/{p.deaths}/{p.assists}
                        </td>
                        <td>
                          {p.lastHits} / {p.denies}
                        </td>
                        <td>
                          {p.gpm} / {p.xpm}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })
      )}

      {match.screenshotPath ? (
        <section>
          <h2 className="gold">Scoreboard shot</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={match.screenshotPath}
            alt="Match scoreboard"
            className="match-shot"
          />
        </section>
      ) : null}
    </div>
  );
}
